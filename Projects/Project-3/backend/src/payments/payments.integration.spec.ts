import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { Company } from '#/database/entities/company.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { BillingAccount } from './billing-account.entity.js';
import { DunningEvaluator } from './dunning-evaluator.service.js';
import type { PaidPlan, PaymentInvoice, PaymentSubscription, VerifiedPaymentEvent } from './payment-provider.js';
import { ReportStripeUsageHandler } from './report-stripe-usage.handler.js';
import { StripeSyncJanitor } from './stripe-sync-janitor.service.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';

const pendingSchema = z.object({
  state: z.literal('pending'),
  intentId: z.uuid(),
  targetPlan: z.enum(['free', 'basic', 'premium']),
  checkoutUrl: z.url().nullable(),
});

describe('Stripe subscriptions (integration)', () => {
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
  afterAll(() => h.stop());

  function subscription(input: Partial<PaymentSubscription> = {}): PaymentSubscription {
    return {
      id: input.id ?? 'sub_test',
      customerId: input.customerId ?? 'cus_test',
      plan: input.plan ?? 'basic',
      status: input.status ?? 'active',
      periodStart: input.periodStart ?? new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: input.periodEnd ?? new Date('2026-04-01T00:00:00.000Z'),
      seatItemId: input.seatItemId ?? 'si_seats',
      latestInvoiceId: input.latestInvoiceId ?? null,
    };
  }

  function event(input: Partial<VerifiedPaymentEvent> = {}): VerifiedPaymentEvent {
    return {
      id: input.id ?? `evt_${crypto.randomUUID()}`,
      type: input.type ?? 'checkout.session.completed',
      createdAt: input.createdAt ?? h.clock.now(),
      livemode: input.livemode ?? false,
      customerId: input.customerId ?? 'cus_test',
      subscriptionId: input.subscriptionId ?? 'sub_test',
      invoiceId: input.invoiceId ?? null,
      checkoutSessionId: input.checkoutSessionId ?? null,
    };
  }

  function sendWebhook(paymentEvent: VerifiedPaymentEvent) {
    const body = h.payments.issueWebhook(paymentEvent);
    return h
      .http()
      .post('/webhooks/stripe')
      .set('stripe-signature', 'valid')
      .set('content-type', 'application/json')
      .send(body.toString('utf8'));
  }

  async function beginPaid(plan: PaidPlan = 'basic') {
    const response = await h
      .http()
      .post('/subscriptions/me')
      .set(...h.bearer(session))
      .send({ plan })
      .expect(202);
    return pendingSchema.parse(response.body);
  }

  async function activate(plan: PaidPlan = 'basic'): Promise<BillingAccount> {
    await beginPaid(plan);
    const account = await h.dataSource.getRepository(BillingAccount).findOneByOrFail({
      companyId: admin.companyId,
    });
    const external = subscription({
      customerId: account.stripeCustomerId ?? undefined,
      plan,
      seatItemId: plan === 'basic' ? 'si_seats' : null,
    });
    h.payments.subscriptions.set(external.id, external);
    await sendWebhook(
      event({
        customerId: external.customerId,
        subscriptionId: external.id,
        checkoutSessionId: account.pendingCheckoutSessionId,
      }),
    ).expect(200);
    return h.dataSource.getRepository(BillingAccount).findOneByOrFail({ companyId: admin.companyId });
  }

  it('keeps a paid plan pending until a verified Checkout webhook provisions it', async () => {
    const pending = await beginPaid('basic');

    expect(pending.checkoutUrl).toContain(pending.intentId);
    expect(await h.dataSource.getRepository(Subscription).count()).toBe(0);
    const account = await h.dataSource.getRepository(BillingAccount).findOneByOrFail({
      companyId: admin.companyId,
    });
    const external = subscription({ customerId: account.stripeCustomerId ?? undefined });
    h.payments.subscriptions.set(external.id, external);

    const response = await sendWebhook(
      event({
        id: 'evt_checkout',
        customerId: external.customerId,
        subscriptionId: external.id,
        checkoutSessionId: account.pendingCheckoutSessionId,
      }),
    ).expect(200);

    expect(response.body).toEqual({ received: true, duplicate: false, applied: true });
    expect(
      await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId: admin.companyId }),
    ).toMatchObject({ plan: 'basic' });
    const duplicate = await sendWebhook(
      event({
        id: 'evt_checkout',
        customerId: external.customerId,
        subscriptionId: external.id,
        checkoutSessionId: account.pendingCheckoutSessionId,
      }),
    ).expect(200);
    expect(duplicate.body.duplicate).toBe(true);
  });

  it('supersedes old Checkout sessions and cancels a stale accidental subscription', async () => {
    await beginPaid('basic');
    const first = await h.dataSource.getRepository(BillingAccount).findOneByOrFail({ companyId: admin.companyId });
    await beginPaid('premium');
    const current = await h.dataSource.getRepository(BillingAccount).findOneByOrFail({ companyId: admin.companyId });
    const stale = subscription({ id: 'sub_stale', customerId: current.stripeCustomerId ?? undefined });
    h.payments.subscriptions.set(stale.id, stale);

    await sendWebhook(
      event({
        id: 'evt_stale',
        customerId: stale.customerId,
        subscriptionId: stale.id,
        checkoutSessionId: first.pendingCheckoutSessionId,
      }),
    ).expect(200);

    expect(await h.dataSource.getRepository(Subscription).count()).toBe(0);
    // The cancellation is a queued task (it retries if Stripe is down), so it happens when the queue runs.
    await h.drainTasks();
    expect(h.payments.cancellations.at(-1)?.subscriptionId).toBe('sub_stale');
    expect(h.payments.expiredSessions).toContain(first.pendingCheckoutSessionId);
  });

  it('requests paid changes and cancellation externally, applying each only from current Stripe state', async () => {
    const account = await activate('basic');
    const change = await h
      .http()
      .patch('/subscriptions/me')
      .set(...h.bearer(session))
      .send({ plan: 'premium' })
      .expect(202);
    expect(pendingSchema.parse(change.body).checkoutUrl).toBeNull();
    expect(h.payments.changes.at(-1)).toMatchObject({ targetPlan: 'premium' });
    expect((await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId: admin.companyId })).plan).toBe('basic');

    const premium = subscription({
      id: account.stripeSubscriptionId ?? undefined,
      customerId: account.stripeCustomerId ?? undefined,
      plan: 'premium',
      seatItemId: null,
    });
    h.payments.subscriptions.set(premium.id, premium);
    await sendWebhook(event({ type: 'customer.subscription.updated', customerId: premium.customerId, subscriptionId: premium.id })).expect(200);
    expect((await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId: admin.companyId })).plan).toBe('premium');

    await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' }).expect(202);
    expect(h.payments.cancellations.at(-1)?.subscriptionId).toBe(premium.id);
    await sendWebhook(event({ type: 'customer.subscription.deleted', customerId: premium.customerId, subscriptionId: premium.id })).expect(200);
    expect((await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId: admin.companyId })).plan).toBe('free');
  });

  it('a paid plan with no Stripe subscription behind it can still be left: Free applies locally, another paid plan starts a Checkout', async () => {
    // As if chosen while payments were off, or seeded: Basic, and no `stripeSubscriptionId`.
    await h.subscribe(session, 'free');
    await h.dataSource.query(`UPDATE subscription SET plan = 'basic' WHERE "companyId" = $1`, [admin.companyId]);

    const upgrade = await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'premium' }).expect(202);
    expect(pendingSchema.parse(upgrade.body).checkoutUrl).not.toBeNull();
    expect(h.payments.changes).toHaveLength(0);

    await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' }).expect(200);
    expect((await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId: admin.companyId })).plan).toBe('free');
    expect(h.payments.cancellations).toHaveLength(0);
  });

  it('starts grace on payment failure, suspends after seven days, and reactivates after payment', async () => {
    const account = await activate('premium');
    const stripeInvoice: PaymentInvoice = {
      id: 'in_failed',
      customerId: account.stripeCustomerId ?? 'missing',
      subscriptionId: account.stripeSubscriptionId,
      status: 'open',
      totalCents: 30_000,
      currency: 'usd',
      periodStart: new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-01T00:00:00.000Z'),
      dueAt: null,
      hostedUrl: 'https://invoice.stripe.test/in_failed',
      pdfUrl: 'https://invoice.stripe.test/in_failed.pdf',
      attempts: 1,
      attemptedAt: h.clock.now(),
      paidAt: null,
    };
    h.payments.invoices.set(stripeInvoice.id, stripeInvoice);
    await sendWebhook(event({ type: 'invoice.payment_failed', customerId: stripeInvoice.customerId, subscriptionId: null, invoiceId: stripeInvoice.id })).expect(200);

    h.clock.advance(8 * 86_400_000);
    expect(await h.app.get(DunningEvaluator).evaluate()).toBe(1);
    expect((await h.dataSource.getRepository(Company).findOneByOrFail({ id: admin.companyId })).status).toBe('suspended');
    // Everyone is locked out now, so the billing address is told in the same step.
    await h.drainTasks();
    expect(h.mail.to(admin.email).some((email) => email.subject.endsWith('is suspended until payment is made'))).toBe(true);
    const suspendedSession = await h.login(admin.email);
    const portal = await h.http().post('/billing/portal-session').set(...h.bearer(suspendedSession)).expect(200);
    expect(portal.body.url).toContain(account.stripeCustomerId);

    stripeInvoice.status = 'paid';
    stripeInvoice.paidAt = h.clock.now();
    h.payments.invoices.set(stripeInvoice.id, stripeInvoice);
    await sendWebhook(event({ type: 'invoice.payment_succeeded', customerId: stripeInvoice.customerId, subscriptionId: null, invoiceId: stripeInvoice.id })).expect(200);
    expect((await h.dataSource.getRepository(Company).findOneByOrFail({ id: admin.companyId })).status).toBe('active');
  });

  it('lets a suspended company back in once Stripe has ended its subscription: it is a Free company now', async () => {
    const account = await activate('premium');
    const stripeInvoice: PaymentInvoice = {
      id: 'in_unpaid',
      customerId: account.stripeCustomerId ?? 'missing',
      subscriptionId: account.stripeSubscriptionId,
      status: 'open',
      totalCents: 30_000,
      currency: 'usd',
      periodStart: new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-01T00:00:00.000Z'),
      dueAt: null,
      hostedUrl: 'https://invoice.stripe.test/in_unpaid',
      pdfUrl: 'https://invoice.stripe.test/in_unpaid.pdf',
      attempts: 1,
      attemptedAt: h.clock.now(),
      paidAt: null,
    };
    h.payments.invoices.set(stripeInvoice.id, stripeInvoice);
    await sendWebhook(event({ type: 'invoice.payment_failed', customerId: stripeInvoice.customerId, subscriptionId: null, invoiceId: stripeInvoice.id })).expect(200);
    h.clock.advance(8 * 86_400_000);
    expect(await h.app.get(DunningEvaluator).evaluate()).toBe(1);
    const suspendedSession = await h.login(admin.email);
    await h.http().get('/auth/me').set(...h.bearer(suspendedSession)).expect(200);

    await sendWebhook(
      event({ type: 'customer.subscription.deleted', customerId: stripeInvoice.customerId, subscriptionId: account.stripeSubscriptionId }),
    ).expect(200);

    expect((await h.dataSource.getRepository(Company).findOneByOrFail({ id: admin.companyId })).status).toBe('active');
    expect((await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId: admin.companyId })).plan).toBe('free');
    await h.http().get('/subscriptions/me').set(...h.bearer(suspendedSession)).expect(200);
  });

  it('synchronizes active Basic seats in order', async () => {
    await activate('basic');
    const employee = await h.inviteAndAccept(session, admin.companyId);
    await h.drainTasks();
    expect(h.payments.seatUpdates.map((request) => request.quantity)).toEqual([1]);

    await h.http().delete(`/employees/${employee.userId}`).set(...h.bearer(session)).expect(200);
    await h.drainTasks();
    expect(h.payments.seatUpdates.map((request) => request.quantity)).toEqual([1, 0]);
    expect(h.payments.seatUpdates[0]?.idempotencyKey).not.toBe(h.payments.seatUpdates[1]?.idempotencyKey);
  });

  it('tells Stripe the seat count when it adopts a subscription for a company that already had employees', async () => {
    // Premium without a Stripe subscription (see above), with an employee who accepted before there was anything to sync.
    await h.subscribe(session, 'free');
    await h.dataSource.query(`UPDATE subscription SET plan = 'premium' WHERE "companyId" = $1`, [admin.companyId]);
    await h.inviteAndAccept(session, admin.companyId);
    await h.drainTasks();
    expect(h.payments.seatUpdates).toHaveLength(0);

    await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'basic' }).expect(202);
    const account = await h.dataSource.getRepository(BillingAccount).findOneByOrFail({ companyId: admin.companyId });
    const external = subscription({ customerId: account.stripeCustomerId ?? undefined, plan: 'basic' });
    h.payments.subscriptions.set(external.id, external);
    await sendWebhook(
      event({ customerId: external.customerId, subscriptionId: external.id, checkoutSessionId: account.pendingCheckoutSessionId }),
    ).expect(200);
    await h.drainTasks();

    expect(h.payments.seatUpdates.map((request) => request.quantity)).toEqual([1]);
  });

  it('reports every Premium upload to the meter once using the immutable usage-event id', async () => {
    await activate('premium');
    await h.upload(session).expect(201);
    await h.drainTasks();

    const usage = await h.dataSource.getRepository(UsageEvent).findOneByOrFail({ companyId: admin.companyId });
    expect(h.payments.meterEvents).toEqual([
      expect.objectContaining({ usageEventId: usage.id, customerId: expect.stringMatching(/^cus_/) }),
    ]);
    await h.app.get(ReportStripeUsageHandler).handle({ usageEventId: usage.id });
    expect(h.payments.meterEvents).toHaveLength(1);
  });

  it('puts a Stripe sync that gave up back on the queue after a few hours, and leaves other dead tasks alone', async () => {
    const tasks = h.dataSource.getRepository(BackgroundTask);
    const usageEventId = crypto.randomUUID();
    const dead = await tasks.save(
      tasks.create({ type: 'report_stripe_usage', payload: { usageEventId }, status: 'dead', attempts: 5, runAfter: new Date(), lastError: 'Stripe was down', lockedAt: null, correlationId: null }),
    );
    const other = await tasks.save(
      tasks.create({ type: 'send_email', payload: {}, status: 'dead', attempts: 5, runAfter: new Date(), lastError: 'bounced', lockedAt: null, correlationId: null }),
    );
    const janitor = h.app.get(StripeSyncJanitor);

    expect(await janitor.reviveDeadTasks(new Date())).toBe(0); // only just died
    expect(await janitor.reviveDeadTasks(new Date(Date.now() + 7 * 60 * 60 * 1000))).toBe(1);

    expect(await tasks.findOneByOrFail({ id: dead.id })).toMatchObject({ status: 'pending', attempts: 0 });
    expect((await tasks.findOneByOrFail({ id: other.id })).status).toBe('dead');
    expect(await janitor.reviveDeadTasks(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000))).toBe(0); // a week on, it is let go
  });

  it('rejects unsigned webhook bodies without applying state', async () => {
    await h.http().post('/webhooks/stripe').send({ event: 'fake' }).expect(400);
    expect(await h.dataSource.getRepository(Subscription).count()).toBe(0);
  });
});
