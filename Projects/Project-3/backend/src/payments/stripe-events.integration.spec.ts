import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryFailedError } from 'typeorm';
import { z } from 'zod';
import { AppHarness, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { Invoice } from '#/billing/invoice.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { BillingAccount } from './billing-account.entity.js';
import { DunningEvaluator } from './dunning-evaluator.service.js';
import type { PaidPlan, PaymentInvoice, PaymentSubscription, VerifiedPaymentEvent } from './payment-provider.js';
import { StripeEvent } from './stripe-event.entity.js';

const DAY = 86_400_000;
const pendingSchema = z.object({ checkoutUrl: z.url().nullable() });

/**
 * Stripe does not deliver events in a guaranteed order, and what matters is WHICH subscription an event is about, not
 * which came first. These specs deliver the same facts in every order Stripe can, and check what a company ends up with.
 */
describe('Stripe event ordering, recovery and duplicates (integration)', () => {
  let h: AppHarness;
  let admin: RegisteredAccount;
  let session: SessionBody;

  beforeAll(async () => {
    h = await AppHarness.start({ payments: true });
  }, 120_000);
  beforeEach(async () => {
    await h.reset();
    admin = await h.registerAndActivate();
    session = await h.login(admin.email);
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  const subscription = (input: Partial<PaymentSubscription> = {}): PaymentSubscription => ({
    id: input.id ?? 'sub_live',
    customerId: input.customerId ?? 'cus_test',
    plan: input.plan ?? 'basic',
    status: input.status ?? 'active',
    periodStart: input.periodStart ?? new Date('2026-03-01T00:00:00.000Z'),
    periodEnd: input.periodEnd ?? new Date('2026-04-01T00:00:00.000Z'),
    seatItemId: input.seatItemId === undefined ? 'si_seats' : input.seatItemId,
    latestInvoiceId: input.latestInvoiceId ?? null,
  });

  const invoice = (input: Partial<PaymentInvoice> & { id: string }): PaymentInvoice => ({
    customerId: 'cus_test',
    subscriptionId: 'sub_live',
    status: 'paid',
    totalCents: 30_000,
    currency: 'usd',
    periodStart: new Date('2026-03-01T00:00:00.000Z'),
    periodEnd: new Date('2026-04-01T00:00:00.000Z'),
    dueAt: null,
    hostedUrl: `https://invoice.stripe.test/${input.id}`,
    pdfUrl: null,
    attempts: 1,
    attemptedAt: new Date('2026-03-01T00:00:00.000Z'),
    paidAt: new Date('2026-03-01T00:00:00.000Z'),
    ...input,
  });

  const event = (
    type: string,
    input: Partial<Omit<VerifiedPaymentEvent, 'type'>> = {},
  ): VerifiedPaymentEvent => ({
    id: input.id ?? `evt_${crypto.randomUUID()}`,
    type,
    createdAt: h.clock.now(),
    livemode: false,
    customerId: input.customerId === undefined ? 'cus_test' : input.customerId,
    subscriptionId: input.subscriptionId === undefined ? 'sub_live' : input.subscriptionId,
    invoiceId: input.invoiceId ?? null,
    checkoutSessionId: input.checkoutSessionId ?? null,
  });

  const send = (paymentEvent: VerifiedPaymentEvent) =>
    h
      .http()
      .post('/webhooks/stripe')
      .set('stripe-signature', 'valid')
      .set('content-type', 'application/json')
      .send(h.payments.issueWebhook(paymentEvent).toString('utf8'));

  /** Starts a paid plan request; returns the account (with its pending Checkout session) and a matching Stripe subscription. */
  async function requested(plan: PaidPlan = 'basic') {
    const response = await h.http().post('/subscriptions/me').set(...h.bearer(session)).send({ plan }).expect(202);
    expect(pendingSchema.parse(response.body).checkoutUrl).not.toBeNull();
    const account = await accountRow();
    const external = subscription({
      customerId: account.stripeCustomerId ?? 'missing',
      plan,
      seatItemId: plan === 'basic' ? 'si_seats' : null,
    });
    h.payments.subscriptions.set(external.id, external);
    return { account, external, sessionId: account.pendingCheckoutSessionId ?? 'missing' };
  }

  async function activated(plan: PaidPlan = 'basic') {
    const { account, external, sessionId } = await requested(plan);
    await send(
      event('checkout.session.completed', {
        customerId: external.customerId,
        subscriptionId: external.id,
        checkoutSessionId: sessionId,
      }),
    ).expect(200);
    return { account: await accountRow(), external, sessionId, customerId: account.stripeCustomerId ?? 'missing' };
  }

  const accountRow = () => h.dataSource.getRepository(BillingAccount).findOneByOrFail({ companyId: admin.companyId });
  const planOf = async () =>
    (await h.dataSource.getRepository(Subscription).findOneBy({ companyId: admin.companyId }))?.plan ?? null;
  const companyStatus = async () =>
    (await h.dataSource.getRepository(Company).findOneByOrFail({ id: admin.companyId })).status;
  const cancelTasks = () =>
    h.dataSource.getRepository(BackgroundTask).find({ where: { type: 'cancel_stripe_subscription' }, order: { createdAt: 'ASC' } });
  const audits = (action: string) => h.dataSource.getRepository(AuditLogEntry).find({ where: { action } });
  const mailWithSubject = (prefix: string) =>
    h.mail.to(admin.email).filter((mail) => mail.subject.startsWith(prefix));
  const remember = (stripeInvoice: PaymentInvoice) => h.payments.invoices.set(stripeInvoice.id, stripeInvoice);

  // ---- B1: event order -----------------------------------------------------

  describe('the same subscription, whichever event arrives first', () => {
    it('customer.subscription.created BEFORE the Checkout event: the late Checkout event refreshes it and cancels nothing', async () => {
      const { external, sessionId } = await requested('basic');

      const early = await send(event('customer.subscription.created', { customerId: external.customerId, subscriptionId: external.id })).expect(200);
      expect(early.body).toMatchObject({ applied: true });
      expect(await planOf()).toBe('basic');

      // The Checkout event names the session the company was waiting for — which the first event already cleared.
      const late = await send(
        event('checkout.session.completed', { customerId: external.customerId, subscriptionId: external.id, checkoutSessionId: sessionId }),
      ).expect(200);
      expect(late.body).toMatchObject({ applied: true, duplicate: false });

      await h.drainTasks();
      expect(h.payments.cancellations).toEqual([]);
      expect(await cancelTasks()).toEqual([]);
      expect(await planOf()).toBe('basic');
      expect((await accountRow()).stripeSubscriptionId).toBe(external.id);
    });

    it('invoice.payment_succeeded BEFORE the Checkout event: the company is activated, and the late Checkout event cancels nothing', async () => {
      const { external, sessionId } = await requested('basic');
      remember(invoice({ id: 'in_first', customerId: external.customerId, subscriptionId: external.id }));

      await send(event('invoice.payment_succeeded', { customerId: external.customerId, subscriptionId: external.id, invoiceId: 'in_first' })).expect(200);
      expect(await planOf()).toBe('basic');
      expect(await h.dataSource.getRepository(Invoice).count({ where: { stripeInvoiceId: 'in_first' } })).toBe(1);

      await send(
        event('checkout.session.completed', { customerId: external.customerId, subscriptionId: external.id, checkoutSessionId: sessionId }),
      ).expect(200);
      await h.drainTasks();

      expect(h.payments.cancellations).toEqual([]);
      expect(await planOf()).toBe('basic');
      expect(await companyStatus()).toBe('active');
    });

    it('the Checkout event first, then the subscription events, is unchanged', async () => {
      const { external } = await activated('basic');

      await send(event('customer.subscription.created', { customerId: external.customerId, subscriptionId: external.id })).expect(200);
      await send(event('customer.subscription.updated', { customerId: external.customerId, subscriptionId: external.id })).expect(200);

      expect(await planOf()).toBe('basic');
      expect(await h.dataSource.getRepository(Subscription).count()).toBe(1);
      expect(await audits('subscription.created')).toHaveLength(1);
      expect(h.payments.cancellations).toEqual([]);
    });

    it('a subscription event for a plan nobody asked for is ignored — and not cancelled either', async () => {
      const { external } = await requested('basic');
      const premium = subscription({ id: 'sub_unasked', customerId: external.customerId, plan: 'premium', seatItemId: null });
      h.payments.subscriptions.set(premium.id, premium);

      const response = await send(event('customer.subscription.created', { customerId: premium.customerId, subscriptionId: premium.id })).expect(200);
      await h.drainTasks();

      expect(response.body).toMatchObject({ applied: false });
      expect(await planOf()).toBeNull();
      expect(h.payments.cancellations).toEqual([]);
    });
  });

  // ---- B1: a real second subscription -----------------------------------------

  describe('a second subscription for a company that already has one', () => {
    it('is cancelled by a queued task that survives a Stripe outage and retries, and is never applied', async () => {
      const { external, customerId } = await activated('basic');
      const extra = subscription({ id: 'sub_extra', customerId, plan: 'premium', seatItemId: null });
      h.payments.subscriptions.set(extra.id, extra);

      const response = await send(
        event('checkout.session.completed', { customerId, subscriptionId: extra.id, checkoutSessionId: 'cs_some_other_session' }),
      ).expect(200);

      expect(response.body).toMatchObject({ applied: false });
      expect(await planOf()).toBe('basic');
      expect((await accountRow()).stripeSubscriptionId).toBe(external.id);
      const [task] = await cancelTasks();
      expect(task?.payload).toEqual({ subscriptionId: 'sub_extra' });
      expect(h.payments.cancellations).toEqual([]); // queued, not done inside the webhook request

      h.payments.cancellationFailures = 1;
      await h.drainTasks();
      expect((await cancelTasks())[0]).toMatchObject({ status: 'pending', attempts: 1 });

      h.clock.advance(120_000);
      await h.drainTasks();
      expect((await cancelTasks())[0]).toMatchObject({ status: 'succeeded' });
      expect(h.payments.cancellations.map((request) => [request.subscriptionId, request.ignoreIfEnded])).toEqual([
        ['sub_extra', true],
        ['sub_extra', true],
      ]);
      expect(h.payments.cancellations[0]?.idempotencyKey).toBe('stale-subscription:sub_extra');
    });

    it('its deleted event does NOT downgrade the company that is still paying for the real one', async () => {
      const { external, customerId } = await activated('basic');
      const extra = subscription({ id: 'sub_extra', customerId, status: 'canceled' });
      h.payments.subscriptions.set(extra.id, extra);

      const response = await send(event('customer.subscription.deleted', { customerId, subscriptionId: extra.id })).expect(200);

      expect(response.body).toMatchObject({ applied: false });
      expect(await planOf()).toBe('basic');
      const account = await accountRow();
      expect(account).toMatchObject({ stripeSubscriptionId: external.id, status: 'current' });
    });

    it('its invoices never start a grace period, mark anything paid, or send mail', async () => {
      const { customerId } = await activated('basic');
      const extra = subscription({ id: 'sub_extra', customerId });
      h.payments.subscriptions.set(extra.id, extra);
      remember(invoice({ id: 'in_extra', customerId, subscriptionId: 'sub_extra', status: 'open', paidAt: null }));

      const response = await send(
        event('invoice.payment_failed', { customerId, subscriptionId: 'sub_extra', invoiceId: 'in_extra' }),
      ).expect(200);
      await h.drainTasks();

      expect(response.body).toMatchObject({ applied: false });
      expect(await accountRow()).toMatchObject({ status: 'current', graceEndsAt: null });
      expect(await h.dataSource.getRepository(Invoice).count({ where: { stripeInvoiceId: 'in_extra' } })).toBe(0);
      expect(mailWithSubject('Payment')).toEqual([]);
    });

    it('a Checkout completed for a session that was superseded is cancelled even when nothing is adopted yet', async () => {
      const first = await requested('basic');
      await requested('premium'); // supersedes the first session
      const stale = subscription({ id: 'sub_stale', customerId: first.external.customerId });
      h.payments.subscriptions.set(stale.id, stale);

      await send(
        event('checkout.session.completed', { customerId: stale.customerId, subscriptionId: stale.id, checkoutSessionId: first.sessionId }),
      ).expect(200);

      expect(await planOf()).toBeNull();
      expect((await cancelTasks()).map((task) => task.payload)).toEqual([{ subscriptionId: 'sub_stale' }]);
    });
  });

  // ---- statuses ---------------------------------------------------------------

  describe('subscription status', () => {
    it('an unpaid first attempt (incomplete) activates nothing until it becomes active', async () => {
      const { external, sessionId } = await requested('basic');
      h.payments.subscriptions.set(external.id, { ...external, status: 'incomplete' });

      await send(
        event('checkout.session.completed', { customerId: external.customerId, subscriptionId: external.id, checkoutSessionId: sessionId }),
      ).expect(200);
      expect(await planOf()).toBeNull();
      expect((await accountRow()).pendingCheckoutSessionId).toBe(sessionId);

      h.payments.subscriptions.set(external.id, { ...external, status: 'active' });
      await send(event('customer.subscription.updated', { customerId: external.customerId, subscriptionId: external.id })).expect(200);
      expect(await planOf()).toBe('basic');
    });

    it('past_due keeps the plan but marks the account past due; canceled through an update ends the plan', async () => {
      const { external } = await activated('basic');

      h.payments.subscriptions.set(external.id, { ...external, status: 'past_due' });
      await send(event('customer.subscription.updated', { customerId: external.customerId, subscriptionId: external.id })).expect(200);
      expect(await planOf()).toBe('basic');
      const pastDue = await accountRow();
      expect(pastDue.status).toBe('past_due');
      // The grace period starts from the subscription status alone: the invoice event may arrive later, or never.
      expect(pastDue.graceEndsAt?.getTime()).toBeGreaterThan(h.clock.now().getTime());

      h.payments.subscriptions.set(external.id, { ...external, status: 'canceled' });
      await send(event('customer.subscription.updated', { customerId: external.customerId, subscriptionId: external.id })).expect(200);
      expect(await planOf()).toBe('free');
      expect(await accountRow()).toMatchObject({ stripeSubscriptionId: null, status: 'cancelled' });
    });

    it('a status Gridline has never seen changes nothing', async () => {
      const { external } = await activated('basic');
      h.payments.subscriptions.set(external.id, { ...external, status: 'brand_new_status' });

      const response = await send(event('customer.subscription.updated', { customerId: external.customerId, subscriptionId: external.id })).expect(200);

      expect(response.body).toMatchObject({ applied: false });
      expect(await planOf()).toBe('basic');
    });
  });

  // ---- M1: the "payment received" email and reactivation ----------------------------

  describe('a payment is only a recovery when it recovers something', () => {
    it('an ordinary payment — the first, or a renewal — sends no "payment received" mail, and is audited once even though two events report it', async () => {
      const { external, customerId } = await activated('premium');
      remember(invoice({ id: 'in_renewal', customerId, subscriptionId: external.id }));

      await send(event('invoice.payment_succeeded', { customerId, subscriptionId: external.id, invoiceId: 'in_renewal' })).expect(200);
      await send(event('invoice.paid', { customerId, subscriptionId: external.id, invoiceId: 'in_renewal' })).expect(200);
      await h.drainTasks();

      expect(mailWithSubject('Payment received')).toEqual([]);
      expect(await audits('billing.payment_succeeded')).toHaveLength(1);
      expect(await accountRow()).toMatchObject({ status: 'current', graceEndsAt: null });
    });

    it('a payment after a failure clears the grace period and sends exactly one "payment received" mail', async () => {
      const { external, customerId } = await activated('premium');
      const open = invoice({ id: 'in_retry', customerId, subscriptionId: external.id, status: 'open', paidAt: null });
      remember(open);
      await send(event('invoice.payment_failed', { customerId, subscriptionId: external.id, invoiceId: 'in_retry' })).expect(200);
      expect((await accountRow()).status).toBe('past_due');

      remember({ ...open, status: 'paid', paidAt: h.clock.now() });
      await send(event('invoice.payment_succeeded', { customerId, subscriptionId: external.id, invoiceId: 'in_retry' })).expect(200);
      await send(event('invoice.paid', { customerId, subscriptionId: external.id, invoiceId: 'in_retry' })).expect(200);
      await h.drainTasks();

      expect(await accountRow()).toMatchObject({ status: 'current', graceEndsAt: null });
      expect(mailWithSubject('Payment received')).toHaveLength(1);
      expect(await audits('billing.payment_succeeded')).toHaveLength(1);
    });

    it('a suspended company stays suspended until EVERY overdue invoice is paid', async () => {
      const { external, customerId } = await activated('premium');
      const first = invoice({ id: 'in_one', customerId, subscriptionId: external.id, status: 'open', paidAt: null });
      const second = invoice({ id: 'in_two', customerId, subscriptionId: external.id, status: 'open', paidAt: null });
      remember(first);
      remember(second);
      await send(event('invoice.payment_failed', { customerId, subscriptionId: external.id, invoiceId: 'in_one' })).expect(200);
      await send(event('invoice.payment_failed', { customerId, subscriptionId: external.id, invoiceId: 'in_two' })).expect(200);
      h.clock.advance(8 * DAY);
      expect(await h.app.get(DunningEvaluator).evaluate()).toBe(1);
      expect(await companyStatus()).toBe('suspended');
      await h.drainTasks();
      expect(h.mail.to(admin.email).filter((mail) => mail.subject.endsWith('is suspended until payment is made'))).toHaveLength(1);

      remember({ ...first, status: 'paid', paidAt: h.clock.now() });
      await send(event('invoice.payment_succeeded', { customerId, subscriptionId: external.id, invoiceId: 'in_one' })).expect(200);
      await h.drainTasks();
      expect(await companyStatus()).toBe('suspended');
      expect((await accountRow()).status).toBe('past_due');
      expect(mailWithSubject('Payment received')).toEqual([]);

      remember({ ...second, status: 'paid', paidAt: h.clock.now() });
      await send(event('invoice.payment_succeeded', { customerId, subscriptionId: external.id, invoiceId: 'in_two' })).expect(200);
      await h.drainTasks();
      expect(await companyStatus()).toBe('active');
      expect(await accountRow()).toMatchObject({ status: 'current', graceEndsAt: null });
      expect(mailWithSubject('Payment received')).toHaveLength(1);
      expect(await audits('billing.company_reactivated')).toHaveLength(1);
    });

    it('the final invoice of a cancelled subscription being paid does not revive the account status', async () => {
      const { external, customerId } = await activated('basic');
      h.payments.subscriptions.set(external.id, { ...external, status: 'canceled' });
      await send(event('customer.subscription.deleted', { customerId, subscriptionId: external.id })).expect(200);
      expect(await accountRow()).toMatchObject({ status: 'cancelled' });
      remember(invoice({ id: 'in_final', customerId, subscriptionId: external.id }));

      await send(event('invoice.payment_succeeded', { customerId, subscriptionId: external.id, invoiceId: 'in_final' })).expect(200);

      expect((await accountRow()).status).toBe('cancelled');
      expect(await planOf()).toBe('free');
    });
  });

  // ---- M2: duplicates ------------------------------------------------------------------

  describe('duplicates and failures', () => {
    it('a redelivered event is answered as a duplicate WITHOUT asking Stripe anything again', async () => {
      const { external, sessionId } = await requested('basic');
      const first = event('checkout.session.completed', {
        id: 'evt_fixed',
        customerId: external.customerId,
        subscriptionId: external.id,
        checkoutSessionId: sessionId,
      });
      await send(first).expect(200);
      const asked = h.payments.retrievals;
      expect(asked).toBeGreaterThan(0);

      const again = await send(first).expect(200);

      expect(again.body).toMatchObject({ duplicate: true, applied: false });
      expect(h.payments.retrievals).toBe(asked);
      expect(await h.dataSource.getRepository(StripeEvent).count({ where: { stripeEventId: 'evt_fixed' } })).toBe(1);
    });

    it('two simultaneous deliveries of one event apply it once and report the other as a duplicate', async () => {
      const { external, sessionId } = await requested('basic');
      const shared = event('checkout.session.completed', {
        id: 'evt_race',
        customerId: external.customerId,
        subscriptionId: external.id,
        checkoutSessionId: sessionId,
      });

      const [a, b] = await Promise.all([send(shared), send(shared)]);

      expect([a.status, b.status]).toEqual([200, 200]);
      expect([a.body.duplicate, b.body.duplicate].sort()).toEqual([false, true]);
      expect(await h.dataSource.getRepository(Subscription).count()).toBe(1);
      expect(await audits('subscription.created')).toHaveLength(1);
    });

    it('a unique-constraint failure somewhere ELSE in the transaction is an error (so Stripe retries), not a "duplicate"', async () => {
      const { external, sessionId } = await requested('basic');
      const uniqueViolation = new QueryFailedError(
        'INSERT INTO something',
        [],
        Object.assign(new Error('duplicate key value violates unique constraint "elsewhere"'), { code: '23505' }),
      );
      vi.spyOn(h.app.get(AuditService), 'record').mockRejectedValueOnce(uniqueViolation);
      const delivery = event('checkout.session.completed', {
        id: 'evt_retry_me',
        customerId: external.customerId,
        subscriptionId: external.id,
        checkoutSessionId: sessionId,
      });

      await send(delivery).expect(500);

      // Nothing was kept — not even the event's own row — so the retry is treated as new.
      expect(await h.dataSource.getRepository(StripeEvent).count()).toBe(0);
      expect(await planOf()).toBeNull();

      const retried = await send(delivery).expect(200);
      expect(retried.body).toMatchObject({ duplicate: false, applied: true });
      expect(await planOf()).toBe('basic');
    });

    it('an event for a customer Gridline does not know is recorded and ignored', async () => {
      const stranger = subscription({ id: 'sub_stranger', customerId: 'cus_stranger' });
      h.payments.subscriptions.set(stranger.id, stranger);

      const response = await send(event('customer.subscription.created', { customerId: 'cus_stranger', subscriptionId: stranger.id })).expect(200);

      expect(response.body).toMatchObject({ duplicate: false, applied: false });
      expect(await h.dataSource.getRepository(Subscription).count()).toBe(0);
    });
  });
});
