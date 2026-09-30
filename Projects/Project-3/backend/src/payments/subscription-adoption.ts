import type { PaidPlan } from './payment-provider.js';

/** What Stripe's subscription `status` means for us. */
export type SubscriptionStatusClass = 'active' | 'past_due' | 'pending' | 'ended';

/**
 * `active` and `trialing` are paying. `past_due`, `unpaid` and `paused` have stopped paying (the grace period and
 * suspension apply). `incomplete` is a first payment that has not gone through yet, so nothing is activated. `canceled`
 * and `incomplete_expired` are over. A status this code has never heard of (a newer API) is `pending`: change nothing
 * rather than guess, because guessing wrong either grants a paid plan for free or takes one away from a paying customer.
 */
export function classifySubscriptionStatus(status: string): SubscriptionStatusClass {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'ended';
    default:
      return 'pending';
  }
}

export interface AdoptionAccount {
  /** The Stripe subscription this company's plan currently follows. */
  stripeSubscriptionId: string | null;
  pendingCheckoutSessionId: string | null;
  pendingIntentId: string | null;
  pendingPlan: 'free' | PaidPlan | null;
}

export interface AdoptionSubscription {
  id: string;
  plan: PaidPlan;
  status: string;
}

export interface AdoptionEvent {
  type: string;
  checkoutSessionId: string | null;
}

export type SubscriptionAction =
  | { kind: 'apply_paid'; status: 'current' | 'past_due' }
  | { kind: 'apply_free' }
  /** A second, live subscription for a customer that should have one: cancel it, apply nothing. */
  | { kind: 'cancel'; subscriptionId: string }
  | { kind: 'ignore' };

const IGNORE: SubscriptionAction = { kind: 'ignore' };

/**
 * What a verified Stripe event about a subscription should do to a company. Pure, so every ordering Stripe can
 * deliver is a unit test rather than a hope — Stripe documents that it does NOT guarantee event order, and
 * `checkout.session.completed` routinely arrives after `customer.subscription.created` and `invoice.payment_succeeded`.
 *
 * The rule is about WHICH subscription, not which event came first:
 * - The company's own subscription (the one it has adopted): follow its status. Always safe, in any order.
 * - Any OTHER live subscription while one is adopted is an accident (a second Checkout was completed): cancel it,
 *   never apply it, and never let its later `deleted` event downgrade the real one.
 * - Nothing adopted yet: adopt only what the company actually asked for — the subscription of its pending Checkout
 *   session, or (when a subscription/invoice event wins the race) one whose plan matches the pending request.
 *   A completed Checkout for a session we no longer expect is stale: cancel it.
 */
export function decideSubscriptionAction(
  event: AdoptionEvent,
  account: AdoptionAccount,
  subscription: AdoptionSubscription,
): SubscriptionAction {
  const state: SubscriptionStatusClass =
    event.type === 'customer.subscription.deleted' ? 'ended' : classifySubscriptionStatus(subscription.status);
  const adopted = account.stripeSubscriptionId;

  if (adopted !== null && subscription.id !== adopted) {
    if (state === 'ended') return IGNORE;
    // Invoice events of a foreign subscription never change this company's state; its subscription events do the cancelling.
    if (event.type.startsWith('invoice.')) return IGNORE;
    return { kind: 'cancel', subscriptionId: subscription.id };
  }

  if (adopted === subscription.id) return followStatus(state);

  // Nothing adopted yet.
  if (state === 'ended') return IGNORE;

  if (event.type === 'checkout.session.completed') {
    const expected =
      event.checkoutSessionId !== null && event.checkoutSessionId === account.pendingCheckoutSessionId;
    return expected ? followStatus(state) : { kind: 'cancel', subscriptionId: subscription.id };
  }

  const requested = account.pendingIntentId !== null && account.pendingPlan === subscription.plan;
  return requested ? followStatus(state) : IGNORE;
}

function followStatus(state: SubscriptionStatusClass): SubscriptionAction {
  switch (state) {
    case 'active':
      return { kind: 'apply_paid', status: 'current' };
    case 'past_due':
      return { kind: 'apply_paid', status: 'past_due' };
    case 'ended':
      return { kind: 'apply_free' };
    case 'pending':
      return IGNORE;
  }
}
