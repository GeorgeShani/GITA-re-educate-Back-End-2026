import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';

const analyticsSchema = z
  .object({
    range: z.object({ from: z.string(), to: z.string(), days: z.number() }).strict(),
    filesPerDay: z.array(z.object({ date: z.string(), files: z.number() }).strict()),
    byEmployee: z.array(
      z.object({ userId: z.uuid(), fullName: z.string(), files: z.number(), bytes: z.number(), lastUploadAt: z.string() }).strict(),
    ),
    storage: z.object({ liveFiles: z.number(), liveBytes: z.number(), uploadedBytesInRange: z.number() }).strict(),
    quota: z
      .object({
        plan: z.string(),
        limit: z.number(),
        used: z.number(),
        periodStart: z.string(),
        periodEnd: z.string(),
        points: z.array(z.object({ date: z.string(), used: z.number(), pace: z.number() }).strict()),
      })
      .strict(),
    planHistory: z.array(
      z
        .object({
          effectiveAt: z.string(),
          fromPlan: z.string().nullable(),
          toPlan: z.string(),
          prorationCents: z.number(),
          invoiceId: z.string().nullable(),
          invoiceTotalCents: z.number().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

const at = (iso: string) => new Date(iso);

describe('GET /analytics/usage (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  async function company(plan: 'free' | 'basic' | 'premium' = 'basic') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  const usage = (session: SessionBody, query: Record<string, string> = {}) =>
    h.http().get('/analytics/usage').set(...h.bearer(session)).query(query);
  const read = async (session: SessionBody, query: Record<string, string> = {}) =>
    analyticsSchema.parse((await usage(session, query).expect(200)).body);

  /**
   * A fixture with hand-countable numbers. March 2026 period; today is Mar 5.
   *   Mar 1: admin uploads 2 files of 100 bytes
   *   Mar 2: employee uploads 1 file of 500 bytes, since DELETED
   *   Mar 3: employee uploads 4 files of 1000 bytes; admin uploads 1 of 100
   */
  async function march() {
    const base = await company('basic');
    const employee = await h.inviteAndAccept(base.session, base.companyId);
    await h.seedUsage(base.companyId, 2, '2026-03-01', { createdAt: at('2026-03-01T09:00:00Z'), sizeBytes: 100 });
    await h.seedUsage(base.companyId, 1, '2026-03-01', {
      createdAt: at('2026-03-02T23:59:59Z'),
      uploaderId: employee.userId,
      sizeBytes: 500,
      deletedAt: at('2026-03-04T00:00:00Z'),
    });
    await h.seedUsage(base.companyId, 4, '2026-03-01', {
      createdAt: at('2026-03-03T00:00:00Z'),
      uploaderId: employee.userId,
      sizeBytes: 1000,
    });
    await h.seedUsage(base.companyId, 1, '2026-03-01', { createdAt: at('2026-03-03T18:00:00Z'), sizeBytes: 100 });
    h.clock.set(at('2026-03-05T12:00:00Z'));
    return { ...base, employee, session: await h.login(base.admin.email) };
  }

  // ---- access -------------------------------------------------------------

  describe('access', () => {
    it('needs a signed-in user', async () => {
      await h.http().get('/analytics/usage').expect(401);
    });

    it('is 403 for an employee', async () => {
      const { session, companyId } = await company();
      const employee = await h.inviteAndAccept(session, companyId);
      await usage(employee.session).expect(403);
    });

    it('is 402 before a plan is chosen', async () => {
      const admin = await h.registerAndActivate();
      await usage(await h.login(admin.email)).expect(402);
    });
  });

  // ---- the numbers, against hand-seeded fixtures ---------------------------

  describe('the numbers', () => {
    it('files per day: every day of the range has a point, including the quiet ones', async () => {
      const { session } = await march();

      const { range, filesPerDay } = await read(session);

      expect(range).toEqual({ from: '2026-03-01T00:00:00.000Z', to: '2026-03-06T00:00:00.000Z', days: 5 });
      expect(filesPerDay).toEqual([
        { date: '2026-03-01', files: 2 },
        { date: '2026-03-02', files: 1 }, // the deleted file: the upload still happened
        { date: '2026-03-03', files: 5 },
        { date: '2026-03-04', files: 0 },
        { date: '2026-03-05', files: 0 },
      ]);
    });

    it('buckets by UTC day at the edges: 23:59:59 belongs to that day, 00:00:00 to the next', async () => {
      const { filesPerDay } = await read((await march()).session, { from: '2026-03-02', to: '2026-03-04' });

      // Mar 2 23:59:59 → Mar 2; Mar 3 00:00:00 → Mar 3.
      expect(filesPerDay).toEqual([
        { date: '2026-03-02', files: 1 },
        { date: '2026-03-03', files: 5 },
      ]);
    });

    it('per-employee activity: counts, bytes and last upload, most active first', async () => {
      const { session, employee, admin } = await march();

      const { byEmployee } = await read(session);

      expect(byEmployee).toHaveLength(2);
      expect(byEmployee[0]).toMatchObject({ userId: employee.userId, files: 5, bytes: 4_500 });
      expect(byEmployee[0]?.lastUploadAt).toBe('2026-03-03T00:00:00.000Z');
      expect(byEmployee[1]).toMatchObject({ userId: admin.userId, files: 3, bytes: 300 });
    });

    it('a removed employee’s history stays', async () => {
      const { session, employee } = await march();
      await h.http().delete(`/employees/${employee.userId}`).set(...h.bearer(session)).expect(200);

      const { byEmployee } = await read(session);

      expect(byEmployee.map((row) => row.userId)).toContain(employee.userId);
    });

    it('storage: live files and bytes exclude the deleted one; the range total includes it', async () => {
      const { session } = await march();

      const { storage } = await read(session);

      expect(storage).toEqual({
        liveFiles: 7, // 2 + 4 + 1; the deleted one is gone
        liveBytes: 200 + 4_000 + 100,
        uploadedBytesInRange: 200 + 500 + 4_000 + 100,
      });
    });

    it('live storage is right now, whatever range was asked for', async () => {
      const { session } = await march();

      const { storage } = await read(session, { from: '2026-03-01', to: '2026-03-02' });

      expect(storage.liveBytes).toBe(4_300);
      expect(storage.uploadedBytesInRange).toBe(200);
    });

    it('quota burn-down: cumulative uploads against the included quota, one point per day so far', async () => {
      const { session } = await march();

      const { quota } = await read(session);

      expect(quota).toMatchObject({ plan: 'basic', limit: 100, used: 8, periodStart: '2026-03-01T00:00:00.000Z', periodEnd: '2026-04-01T00:00:00.000Z' });
      expect(quota.points.map((point) => [point.date, point.used])).toEqual([
        ['2026-03-01', 2],
        ['2026-03-02', 3],
        ['2026-03-03', 8],
        ['2026-03-04', 8],
        ['2026-03-05', 8],
      ]);
      // An even pace of 100 files over 31 days.
      expect(quota.points[0]?.pace).toBe(3.23);
      expect(quota.points[4]?.pace).toBe(16.13);
    });

    it('the burn-down is always the CURRENT period, whatever range was asked for', async () => {
      const { session } = await march();

      const { quota } = await read(session, { from: '2026-03-04', to: '2026-03-05' });

      expect(quota.points).toHaveLength(5);
      expect(quota.used).toBe(8);
    });

    it('the burn-down agrees with the running bill’s file count', async () => {
      const { session } = await march();

      const bill = (await h.http().get('/billing/current').set(...h.bearer(session)).expect(200)).body;

      expect((await read(session)).quota.used).toBe(bill.filesThisPeriod);
    });

    it('a real upload is counted on the day the app clock says', async () => {
      const { session } = await company();
      await h.upload(session).expect(201);

      const { filesPerDay, byEmployee } = await read(session);

      expect(filesPerDay.find((point) => point.date === '2026-03-01')?.files).toBe(1);
      expect(byEmployee).toHaveLength(1);
    });

    it('a quiet company has zeros, not gaps or errors', async () => {
      const { session } = await company('free');

      const data = await read(session);

      expect(data.filesPerDay).toEqual([{ date: '2026-03-01', files: 0 }]);
      expect(data.byEmployee).toEqual([]);
      expect(data.storage).toEqual({ liveFiles: 0, liveBytes: 0, uploadedBytesInRange: 0 });
      expect(data.quota).toMatchObject({ plan: 'free', limit: 10, used: 0 });
    });

    it('prices the period we are IN when the daily job has not rolled the old one', async () => {
      const { admin, companyId } = await company('free');
      await h.seedUsage(companyId, 3, '2026-03-01', { createdAt: at('2026-03-10T00:00:00Z') });
      h.clock.set(at('2026-04-02T12:00:00Z')); // March ended; nothing has run
      const session = await h.login(admin.email);

      const { quota, range } = await read(session);

      expect(range.from).toBe('2026-04-01T00:00:00.000Z');
      expect(quota).toMatchObject({ periodStart: '2026-04-01T00:00:00.000Z', used: 0 });
    });
  });

  // ---- plan history -------------------------------------------------------

  describe('plan history', () => {
    it('lists the first choice, with no outgoing plan and so no invoice', async () => {
      const { session } = await company('basic');

      const { planHistory } = await read(session);

      expect(planHistory).toEqual([
        { effectiveAt: '2026-03-01T12:00:00.000Z', fromPlan: null, toPlan: 'basic', prorationCents: 0, invoiceId: null, invoiceTotalCents: null },
      ]);
    });

    it('joins each change to the invoice that closed the outgoing period, newest first', async () => {
      const { admin, companyId } = await company('basic');
      const first = await h.login(admin.email);
      await h.inviteAndAccept(first, companyId); // a $5 seat, active from Mar 1
      h.clock.set(at('2026-03-11T12:00:00Z')); // 10 days on Basic
      const session = await h.login(admin.email);

      await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'premium' }).expect(200);
      const { planHistory } = await read(session);

      expect(planHistory.map((change) => [change.fromPlan, change.toPlan])).toEqual([
        ['basic', 'premium'],
        [null, 'basic'],
      ]);
      // 10 of 31 days at $5: round(500 × 10 / 31) = 161 cents, on an invoice that says the same.
      expect(planHistory[0]).toMatchObject({ prorationCents: 161, invoiceTotalCents: 161 });
      expect(planHistory[0]?.invoiceId).toBeTruthy();
      const invoice = (await h.http().get(`/billing/invoices/${planHistory[0]?.invoiceId}`).set(...h.bearer(session)).expect(200)).body;
      expect(invoice.totalCents).toBe(161);
    });
  });

  // ---- the range ----------------------------------------------------------

  describe('the range', () => {
    it('reads both ends as UTC days', async () => {
      const { session } = await march();

      const { range } = await read(session, { from: '2026-03-02T15:30:00Z', to: '2026-03-04T02:00:00Z' });

      expect(range).toEqual({ from: '2026-03-02T00:00:00.000Z', to: '2026-03-04T00:00:00.000Z', days: 2 });
    });

    it('can look back beyond the current period', async () => {
      const { session, companyId } = await march();
      await h.seedUsage(companyId, 2, '2026-02-01', { createdAt: at('2026-02-10T00:00:00Z') });

      const { filesPerDay } = await read(session, { from: '2026-02-09', to: '2026-02-12' });

      expect(filesPerDay.map((point) => point.files)).toEqual([0, 2, 0]);
    });

    it.each([
      ['an empty range', { from: '2026-03-05', to: '2026-03-05' }],
      ['a backwards range', { from: '2026-03-05', to: '2026-03-01' }],
      ['more than 366 days', { from: '2025-01-01', to: '2026-03-01' }],
      ['a malformed date', { from: 'yesterday' }],
      ['an unknown parameter', { companyId: randomUUID() }],
    ])('rejects %s', async (_name, query) => {
      const { session } = await company();
      await usage(session, query).expect(400);
    });

    it('accepts exactly 366 days', async () => {
      const { session } = await company();
      const { range } = await read(session, { from: '2025-03-01', to: '2026-03-02' });
      expect(range.days).toBe(366);
    });
  });

  // ---- tenancy ------------------------------------------------------------

  describe('tenancy', () => {
    it('never counts another company’s uploads, files or employees', async () => {
      const mine = await march();
      const other = await company('premium');
      await h.seedUsage(other.companyId, 50, '2026-03-01', { createdAt: at('2026-03-03T10:00:00Z'), sizeBytes: 9_999 });

      const { filesPerDay, storage, byEmployee, quota } = await read(mine.session);

      expect(filesPerDay.reduce((sum, point) => sum + point.files, 0)).toBe(8);
      expect(storage.liveBytes).toBe(4_300);
      expect(byEmployee).toHaveLength(2);
      expect(quota.used).toBe(8);
    });
  });
});
