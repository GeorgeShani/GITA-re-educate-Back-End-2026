import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { BillingAccount } from '#/payments/billing-account.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { BillingCycleService } from './cycle/billing-cycle.service.js';
import { Invoice } from './invoice.entity.js';
import { InvoicingService } from './invoicing.service.js';

const DAY = 86_400_000;

/**
 * Stripe owns the billing periods and invoices of a company on a Stripe subscription. The local engine used to keep rolling
 * such a company too, so a late webhook produced a second, uncollectable invoice, an email and an `invoice.finalized`
 * event Stripe knew nothing about.
 */
describe('the local billing engine leaves Stripe-managed companies alone (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start({ payments: true });
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  /** A Premium company whose plan follows a Stripe subscription (set up directly: the webhook flow has its own specs). */
  async function stripeCompany(): Promise<{ admin: RegisteredAccount; session: SessionBody }> {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, 'free');
    await h.dataSource.query(`UPDATE subscription SET plan = 'premium' WHERE "companyId" = $1`, [admin.companyId]);
    await h.dataSource.getRepository(BillingAccount).insert({
      companyId: admin.companyId,
      stripeCustomerId: `cus_${admin.companyId}`,
      stripeSubscriptionId: `sub_${admin.companyId}`,
      stripeSeatItemId: null,
      status: 'current',
      graceEndsAt: null,
      pendingIntentId: null,
      pendingCheckoutSessionId: null,
      pendingPlan: null,
      pendingCreatedAt: null,
      seatRevision: 0,
    });
    return { admin, session };
  }

  const subscriptionOf = (companyId: string) =>
    h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId });
  const invoices = (companyId: string) => h.dataSource.getRepository(Invoice).count({ where: { companyId } });
  const invoiceMail = () => h.mail.sent.filter((mail) => /invoice/i.test(mail.subject));

  it('the nightly cycle does not roll, invoice or email a company whose period has ended but whose webhook has not arrived', async () => {
    const { admin } = await stripeCompany();
    const before = await subscriptionOf(admin.companyId);
    h.clock.advance(35 * DAY);
    h.mail.clear();

    const result = await h.app.get(BillingCycleService).runCycle();

    expect(result).toEqual({ companiesRolled: 0, invoicesFinalized: 0, failures: 0 });
    expect(await invoices(admin.companyId)).toBe(0);
    const after = await subscriptionOf(admin.companyId);
    expect(after.currentPeriodStart).toEqual(before.currentPeriodStart);
    expect(after.currentPeriodEnd).toEqual(before.currentPeriodEnd);
    await h.drainTasks();
    expect(invoiceMail()).toEqual([]);
  });

  it('an upload after the period ended does not invent a local invoice either', async () => {
    const { admin } = await stripeCompany();
    const before = await subscriptionOf(admin.companyId);
    h.clock.advance(35 * DAY);
    const later = await h.login(admin.email);
    h.mail.clear();

    await h.upload(later).expect(201);
    await h.drainTasks();

    expect(await invoices(admin.companyId)).toBe(0);
    expect((await subscriptionOf(admin.companyId)).currentPeriodEnd).toEqual(before.currentPeriodEnd);
    expect(invoiceMail()).toEqual([]);
  });

  it('closing a period mid-cycle (the local plan-change path) writes no invoice for a Stripe-managed company', async () => {
    const { admin } = await stripeCompany();
    h.clock.advance(10 * DAY);
    h.mail.clear();

    const invoice = await h.dataSource.transaction(async (manager) =>
      h.app
        .get(InvoicingService)
        .closePeriod(manager, await manager.findOneByOrFail(Subscription, { companyId: admin.companyId }), h.clock.now()),
    );

    expect(invoice).toBeNull();
    expect(await invoices(admin.companyId)).toBe(0);
    await h.drainTasks();
    expect(invoiceMail()).toEqual([]);
  });

  it('is selective: an ordinary company in the same cycle is still rolled and invoiced', async () => {
    const stripe = await stripeCompany();
    const ordinary = await h.registerAndActivate();
    await h.subscribe(await h.login(ordinary.email), 'free');
    h.clock.advance(35 * DAY);

    const result = await h.app.get(BillingCycleService).runCycle();

    expect(result.companiesRolled).toBe(1);
    expect(await invoices(ordinary.companyId)).toBeGreaterThan(0);
    expect(await invoices(stripe.admin.companyId)).toBe(0);
  });

  it('hands a company back to the local engine once its Stripe subscription has ended', async () => {
    const { admin } = await stripeCompany();
    await h.dataSource.query(`UPDATE subscription SET plan = 'free' WHERE "companyId" = $1`, [admin.companyId]);
    await h.dataSource.getRepository(BillingAccount).update({ companyId: admin.companyId }, { stripeSubscriptionId: null });
    h.clock.advance(35 * DAY);

    const result = await h.app.get(BillingCycleService).runCycle();

    expect(result.companiesRolled).toBe(1);
    expect(await invoices(admin.companyId)).toBeGreaterThan(0);
  });
});
