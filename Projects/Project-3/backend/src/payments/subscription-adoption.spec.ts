import { describe, expect, it } from 'vitest';
import {
  type AdoptionAccount,
  type AdoptionSubscription,
  classifySubscriptionStatus,
  decideSubscriptionAction,
} from './subscription-adoption.js';

const account = (input: Partial<AdoptionAccount> = {}): AdoptionAccount => ({
  stripeSubscriptionId: null,
  pendingCheckoutSessionId: null,
  pendingIntentId: null,
  pendingPlan: null,
  ...input,
});
const sub = (input: Partial<AdoptionSubscription> = {}): AdoptionSubscription => ({
  id: 'sub_live',
  plan: 'basic',
  status: 'active',
  ...input,
});
const event = (type: string, checkoutSessionId: string | null = null) => ({ type, checkoutSessionId });

describe('classifySubscriptionStatus', () => {
  it.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['past_due', 'past_due'],
    ['unpaid', 'past_due'],
    ['paused', 'past_due'],
    ['incomplete', 'pending'],
    ['canceled', 'ended'],
    ['incomplete_expired', 'ended'],
  ])('%s is %s', (status, expected) => {
    expect(classifySubscriptionStatus(status)).toBe(expected);
  });

  it('treats a status it has never seen as pending: it neither grants nor removes a plan', () => {
    expect(classifySubscriptionStatus('brand_new_status')).toBe('pending');
  });
});

describe('decideSubscriptionAction: the company’s own subscription, in any event order', () => {
  const adopted = account({ stripeSubscriptionId: 'sub_live' });

  it.each([
    'customer.subscription.created',
    'customer.subscription.updated',
    'invoice.payment_succeeded',
    'invoice.finalized',
    // The Checkout event arriving AFTER the subscription was adopted is the same subscription, not a stale one.
    'checkout.session.completed',
  ])('%s just refreshes it', (type) => {
    expect(decideSubscriptionAction(event(type, 'cs_old'), adopted, sub())).toEqual({
      kind: 'apply_paid',
      status: 'current',
    });
  });

  it('follows its status: past due keeps the plan but starts the grace period, incomplete changes nothing', () => {
    expect(decideSubscriptionAction(event('customer.subscription.updated'), adopted, sub({ status: 'past_due' }))).toEqual({
      kind: 'apply_paid',
      status: 'past_due',
    });
    expect(decideSubscriptionAction(event('customer.subscription.updated'), adopted, sub({ status: 'incomplete' }))).toEqual({
      kind: 'ignore',
    });
  });

  it('ends on canceled, incomplete_expired and the deleted event, whatever status the retrieval shows', () => {
    for (const status of ['canceled', 'incomplete_expired']) {
      expect(decideSubscriptionAction(event('customer.subscription.updated'), adopted, sub({ status }))).toEqual({ kind: 'apply_free' });
    }
    expect(decideSubscriptionAction(event('customer.subscription.deleted'), adopted, sub({ status: 'active' }))).toEqual({
      kind: 'apply_free',
    });
  });
});

describe('decideSubscriptionAction: a second subscription while one is adopted', () => {
  const adopted = account({ stripeSubscriptionId: 'sub_live', pendingCheckoutSessionId: 'cs_new' });
  const other = sub({ id: 'sub_extra' });

  it('is cancelled, never applied — even when it arrives through the session we are waiting for', () => {
    expect(decideSubscriptionAction(event('checkout.session.completed', 'cs_new'), adopted, other)).toEqual({
      kind: 'cancel',
      subscriptionId: 'sub_extra',
    });
    expect(decideSubscriptionAction(event('customer.subscription.created'), adopted, other)).toEqual({
      kind: 'cancel',
      subscriptionId: 'sub_extra',
    });
  });

  it('its deleted event is ignored: cancelling the extra one must not downgrade the real one', () => {
    expect(decideSubscriptionAction(event('customer.subscription.deleted'), adopted, other)).toEqual({ kind: 'ignore' });
    expect(decideSubscriptionAction(event('customer.subscription.updated'), adopted, sub({ id: 'sub_extra', status: 'canceled' }))).toEqual({
      kind: 'ignore',
    });
  });

  it('its invoices never change this company’s payment state', () => {
    for (const type of ['invoice.payment_failed', 'invoice.payment_succeeded', 'invoice.finalized']) {
      expect(decideSubscriptionAction(event(type), adopted, other)).toEqual({ kind: 'ignore' });
    }
  });
});

describe('decideSubscriptionAction: nothing adopted yet', () => {
  const waiting = account({ pendingIntentId: 'intent', pendingPlan: 'basic', pendingCheckoutSessionId: 'cs_now' });

  it('adopts the subscription of the pending Checkout session', () => {
    expect(decideSubscriptionAction(event('checkout.session.completed', 'cs_now'), waiting, sub())).toEqual({
      kind: 'apply_paid',
      status: 'current',
    });
  });

  it('adopts when a subscription or invoice event wins the race against the Checkout event, if the plan is what was asked for', () => {
    for (const type of ['customer.subscription.created', 'customer.subscription.updated', 'invoice.payment_succeeded']) {
      expect(decideSubscriptionAction(event(type), waiting, sub())).toEqual({ kind: 'apply_paid', status: 'current' });
    }
  });

  it('does not adopt a subscription for a plan nobody asked for, and does not cancel it either', () => {
    expect(decideSubscriptionAction(event('customer.subscription.created'), waiting, sub({ plan: 'premium' }))).toEqual({
      kind: 'ignore',
    });
  });

  it('does not adopt anything when no request is pending (a subscription made outside the app)', () => {
    expect(decideSubscriptionAction(event('customer.subscription.created'), account(), sub())).toEqual({ kind: 'ignore' });
  });

  it('a completed Checkout for a session we no longer expect is stale: cancel its subscription', () => {
    expect(decideSubscriptionAction(event('checkout.session.completed', 'cs_superseded'), waiting, sub())).toEqual({
      kind: 'cancel',
      subscriptionId: 'sub_live',
    });
    expect(decideSubscriptionAction(event('checkout.session.completed', null), waiting, sub())).toEqual({
      kind: 'cancel',
      subscriptionId: 'sub_live',
    });
    expect(decideSubscriptionAction(event('checkout.session.completed', 'cs_x'), account(), sub())).toEqual({
      kind: 'cancel',
      subscriptionId: 'sub_live',
    });
  });

  it('an unpaid first attempt activates nothing yet, and an already-ended subscription is ignored', () => {
    expect(decideSubscriptionAction(event('checkout.session.completed', 'cs_now'), waiting, sub({ status: 'incomplete' }))).toEqual({
      kind: 'ignore',
    });
    expect(decideSubscriptionAction(event('customer.subscription.updated'), waiting, sub({ status: 'canceled' }))).toEqual({
      kind: 'ignore',
    });
    expect(decideSubscriptionAction(event('customer.subscription.deleted'), waiting, sub())).toEqual({ kind: 'ignore' });
  });
});
