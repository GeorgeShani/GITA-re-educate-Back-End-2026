import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness } from '#test/support/app-harness.js';
import { BillingCycleService } from '#/billing/cycle/billing-cycle.service.js';
import { METRICS } from './business-metrics.js';

/** What the app REPORTS to Observe, through the same seam production uses (only the sink is replaced). */
describe('business metrics and span tags (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  async function company(plan: 'free' | 'basic' | 'premium') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session };
  }

  it('tags every authenticated request with its tenant, and no public one', async () => {
    const { admin, session } = await company('basic');
    h.telemetry.clear();

    await h.http().get('/subscriptions/plans').expect(200);
    expect(h.telemetry.tags).toEqual([]);

    await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
    expect(h.telemetry.tags).toEqual([['companyId', admin.companyId]]);
  });

  it('counts an upload once it has committed — and not a refused one', async () => {
    const { session } = await company('basic');
    h.telemetry.clear();

    await h.upload(session).expect(201);
    await h.upload(session, { content: 'MZ\u0090\u0000not a spreadsheet', name: 'x.csv' }).expect(400);

    expect(h.telemetry.of(METRICS.filesUploaded)).toEqual([{ plan: 'basic' }]);
    expect(h.telemetry.of(METRICS.quotaExceeded)).toEqual([]);
  });

  it('counts a blocked upload as quota exceeded, and that upload is not counted as uploaded', async () => {
    const { admin, session } = await company('free');
    await h.seedUsage(admin.companyId, 10, '2026-03-01');
    h.telemetry.clear();

    await h.upload(session).expect(402);

    expect(h.telemetry.of(METRICS.quotaExceeded)).toEqual([{ plan: 'free', outcome: 'blocked' }]);
    expect(h.telemetry.of(METRICS.filesUploaded)).toEqual([]);
  });

  it('counts a Premium upload past the included files as uploaded AND as an overage', async () => {
    const { admin, session } = await company('premium');
    await h.seedUsage(admin.companyId, 1000, '2026-03-01');
    h.telemetry.clear();

    await h.upload(session).expect(201);

    expect(h.telemetry.of(METRICS.filesUploaded)).toEqual([{ plan: 'premium' }]);
    expect(h.telemetry.of(METRICS.quotaExceeded)).toEqual([{ plan: 'premium', outcome: 'overage' }]);
  });

  it('counts a plan being chosen and a plan being changed, by the plan now in force', async () => {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    h.telemetry.clear();

    await h.http().post('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'basic' }).expect(201);
    h.clock.advance(3 * 86_400_000);
    const later = await h.login(admin.email);
    await h.http().patch('/subscriptions/me').set(...h.bearer(later)).send({ plan: 'premium' }).expect(200);

    expect(h.telemetry.of(METRICS.subscriptionChanged)).toEqual([{ plan: 'basic' }, { plan: 'premium' }]);
  });

  it('does not count a plan change that was refused', async () => {
    const { session } = await company('basic');
    h.telemetry.clear();

    await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'basic' }).expect(409);
    expect(h.telemetry.of(METRICS.subscriptionChanged)).toEqual([]);
  });

  it('counts each invoice as it is finalized: by the rollover, and by a plan change closing a period', async () => {
    const { session, admin } = await company('basic');
    h.clock.advance(3 * 86_400_000);
    const later = await h.login(admin.email);
    h.telemetry.clear();

    await h.http().patch('/subscriptions/me').set(...h.bearer(later)).send({ plan: 'premium' }).expect(200);
    expect(h.telemetry.of(METRICS.invoiceFinalized)).toEqual([{ plan: 'basic' }]);

    // Past the end of the (premium) period: the daily job closes it.
    h.clock.advance(40 * 86_400_000);
    await h.app.get(BillingCycleService).runCycle();
    expect(h.telemetry.of(METRICS.invoiceFinalized)).toEqual([{ plan: 'basic' }, { plan: 'premium' }]);
    expect(session).toBeDefined();
  });

  it('never puts a tenant or a person in a metric label (only the plan and the outcome)', async () => {
    const { admin, session } = await company('basic');
    await h.upload(session).expect(201);

    const labels = JSON.stringify(h.telemetry.counts);
    expect(labels).not.toContain(admin.companyId);
    expect(labels).not.toContain(admin.userId);
    expect(labels).not.toContain(admin.email);
  });
});
