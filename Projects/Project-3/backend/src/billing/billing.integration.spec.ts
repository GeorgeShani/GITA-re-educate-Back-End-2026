import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { BillingCycleService } from './cycle/billing-cycle.service.js';
import { InvoicingService } from './invoicing.service.js';
import { Invoice } from './invoice.entity.js';

const lineSchema = z
  .object({
    kind: z.enum(['seat', 'plan_base', 'overage']),
    description: z.string(),
    unitCents: z.number(),
    amountCents: z.number(),
    userId: z.string().optional(),
    activeDays: z.number().optional(),
    billedDays: z.number().optional(),
    periodDays: z.number().optional(),
    files: z.number().optional(),
  })
  .strict();
const statementSchema = z
  .object({
    plan: z.string(),
    period: z.object({ start: z.string(), end: z.string(), days: z.number() }),
    lineItems: z.array(lineSchema),
    totalCents: z.number(),
    seats: z.number(),
    filesThisPeriod: z.number(),
    dueDate: z.string(),
    asOf: z.string(),
  })
  .strict();
const invoiceSchema = z
  .object({
    id: z.uuid(),
    plan: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    lineItems: z.array(lineSchema),
    totalCents: z.number(),
    status: z.literal('finalized'),
    dueDate: z.string(),
    createdAt: z.string(),
  })
  .strict();
const invoicePage = z.object({
  data: z.array(invoiceSchema),
  meta: z.object({ page: z.number(), limit: z.number(), total: z.number(), totalPages: z.number() }),
});

describe('billing (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  /** A company on `plan`; the clock is 2026-03-01T12:00Z, so its period is [Mar 1, Apr 1). */
  async function company(plan: 'free' | 'basic' | 'premium' = 'basic') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  const at = (iso: string) => h.clock.set(new Date(iso));
  const current = (session: SessionBody) => h.http().get('/billing/current').set(...h.bearer(session));
  const cycle = () => h.app.get(BillingCycleService).runCycle();
  const invoices = (companyId: string) =>
    h.dataSource.getRepository(Invoice).find({ where: { companyId }, order: { periodStart: 'ASC' } });

  async function statement(session: SessionBody) {
    return statementSchema.parse((await current(session).expect(200)).body);
  }

  // ---- who may read -------------------------------------------------------

  describe('access', () => {
    const routes = ['/billing/current', '/billing/invoices', `/billing/invoices/${randomUUID()}`];

    it.each(routes)('%s needs a signed-in user', async (route) => {
      await h.http().get(route).expect(401);
    });

    it.each(routes)('%s is 403 for an employee', async (route) => {
      const { session, companyId } = await company();
      const employee = await h.inviteAndAccept(session, companyId);

      await h.http().get(route).set(...h.bearer(employee.session)).expect(403);
    });

    it.each(routes)('%s is 402 before a plan is chosen', async (route) => {
      const admin = await h.registerAndActivate();
      const session = await h.login(admin.email);

      await h.http().get(route).set(...h.bearer(session)).expect(402);
    });

    it('a suspended company can still read billing — and nothing else', async () => {
      const { session, companyId } = await company();
      await h.dataSource.getRepository(Company).update({ id: companyId }, { status: 'suspended' });

      await current(session).expect(200);
      await h.http().get('/billing/invoices').set(...h.bearer(session)).expect(200);
      await h.http().get('/files').set(...h.bearer(session)).expect(403);
      await h.http().get('/employees').set(...h.bearer(session)).expect(403);
      await h.http().get('/subscriptions/me').set(...h.bearer(session)).expect(403);
    });
  });

  // ---- the running statement ---------------------------------------------

  describe('GET /billing/current', () => {
    it('Free has no line items and owes nothing', async () => {
      const { session } = await company('free');

      expect(await statement(session)).toMatchObject({
        plan: 'free',
        lineItems: [],
        totalCents: 0,
        seats: 1,
        filesThisPeriod: 0,
        period: { start: '2026-03-01T00:00:00.000Z', end: '2026-04-01T00:00:00.000Z', days: 31 },
        dueDate: '2026-04-01T00:00:00.000Z',
        asOf: '2026-03-01T12:00:00.000Z',
      });
    });

    it('an employee who joins mid-period is billed for the days they were active, not a flat $5', async () => {
      const { admin, companyId } = await company('basic');
      at('2026-03-11T12:00:00.000Z'); // day 11: Mar 11 → Apr 1 is 21 of the period's 31 days
      const session = await h.login(admin.email);
      const employee = await h.inviteAndAccept(session, companyId);

      const bill = await statement(session);

      expect(bill.lineItems).toEqual([
        {
          kind: 'seat',
          description: 'Employee seat',
          userId: employee.userId,
          activeDays: 21,
          periodDays: 31,
          unitCents: 500,
          amountCents: 339, // round(500 × 21 / 31), half-up
        },
      ]);
      expect(bill.totalCents).toBe(339);
      expect(bill.seats).toBe(2);
    });

    it('an invited employee holds a seat but bills nothing until they accept', async () => {
      const { session } = await company('basic');
      await h.inviteEmployee(session);

      const bill = await statement(session);

      expect(bill.lineItems).toEqual([]);
      expect(bill.totalCents).toBe(0);
      expect(bill.seats).toBe(1);
    });

    it('removing an employee ends their interval that day', async () => {
      const { admin, companyId } = await company('basic');
      at('2026-03-11T12:00:00.000Z');
      let session = await h.login(admin.email);
      const employee = await h.inviteAndAccept(session, companyId);
      at('2026-03-21T12:00:00.000Z');
      session = await h.login(admin.email);
      await h.http().delete(`/employees/${employee.userId}`).set(...h.bearer(session)).expect(200);

      const bill = await statement(session);

      expect(bill.lineItems).toHaveLength(1);
      expect(bill.lineItems[0]).toMatchObject({ activeDays: 10, amountCents: 161 }); // round(500 × 10 / 31)
      expect(bill.seats).toBe(1);
    });

    it('a re-added employee shows both stretches, each prorated', async () => {
      const { admin, companyId } = await company('basic');
      at('2026-03-05T12:00:00.000Z');
      const session = await h.login(admin.email);
      const employee = await h.inviteAndAccept(session, companyId);
      await h.seedSeatInterval(companyId, employee.userId, new Date('2026-03-01T00:00:00Z'), new Date('2026-03-03T00:00:00Z'));

      const seatLines = (await statement(session)).lineItems.filter((line) => line.userId === employee.userId);

      expect(seatLines.map((line) => line.activeDays).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([2, 27]);
    });

    it('Premium: $300 base, plus $0.50 for every file over 1000', async () => {
      const { session, companyId } = await company('premium');
      await h.seedUsage(companyId, 1_010, '2026-03-01');

      const bill = await statement(session);

      expect(bill.lineItems.map((line) => [line.kind, line.amountCents])).toEqual([
        ['plan_base', 30_000],
        ['overage', 500],
      ]);
      expect(bill.totalCents).toBe(30_500);
      expect(bill.filesThisPeriod).toBe(1_010);
    });

    it('Premium: exactly 1000 files costs no overage', async () => {
      const { session, companyId } = await company('premium');
      await h.seedUsage(companyId, 1_000, '2026-03-01');

      expect((await statement(session)).totalCents).toBe(30_000);
    });

    it('prices the period we are IN when the daily job has not yet rolled the old one', async () => {
      const { admin, companyId } = await company('premium');
      at('2026-04-05T12:00:00.000Z'); // March ended four days ago; nothing has run
      const session = await h.login(admin.email);

      const bill = await statement(session);

      expect(bill.period).toMatchObject({ start: '2026-04-01T00:00:00.000Z', end: '2026-05-01T00:00:00.000Z', days: 30 });
      expect(bill.dueDate).toBe('2026-05-01T00:00:00.000Z');
      expect(bill.totalCents).toBe(30_000);
      // A read writes nothing: no invoice, and the stored period is untouched.
      expect(await invoices(companyId)).toEqual([]);
      const stored = await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId });
      expect(stored.currentPeriodStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });

    it('only counts this period’s files', async () => {
      const { session, companyId } = await company('premium');
      await h.seedUsage(companyId, 1_200, '2026-02-01'); // last period's uploads

      expect((await statement(session)).filesThisPeriod).toBe(0);
    });

    it('never shows another company’s employees or files', async () => {
      const a = await company('premium');
      const b = await company('premium');
      await h.seedUsage(b.companyId, 1_100, '2026-03-01');
      await h.inviteAndAccept(b.session, b.companyId);

      const bill = await statement(a.session);

      expect(bill).toMatchObject({ seats: 1, filesThisPeriod: 0, totalCents: 30_000 });
    });
  });

  // ---- the rollover -------------------------------------------------------

  describe('the billing cycle', () => {
    /** Basic company whose one employee joined on Mar 11 (21 billable days → $3.39). */
    async function basicWithEmployee() {
      const base = await company('basic');
      at('2026-03-11T12:00:00.000Z');
      const session = await h.login(base.admin.email);
      const employee = await h.inviteAndAccept(session, base.companyId);
      return { ...base, employee };
    }

    it('does nothing before a period ends', async () => {
      const { companyId } = await company('premium');
      at('2026-03-31T23:59:00.000Z');

      expect(await cycle()).toEqual({ companiesRolled: 0, invoicesFinalized: 0, failures: 0 });
      expect(await invoices(companyId)).toEqual([]);
    });

    it('finalizes the invoice with the right lines and opens the next period', async () => {
      const { companyId, employee } = await basicWithEmployee();
      at('2026-04-01T00:10:00.000Z');

      expect(await cycle()).toEqual({ companiesRolled: 1, invoicesFinalized: 1, failures: 0 });

      const [invoice] = await invoices(companyId);
      expect(invoice).toMatchObject({
        plan: 'basic',
        totalCents: 339,
        status: 'finalized',
        periodStart: new Date('2026-03-01T00:00:00Z'),
        periodEnd: new Date('2026-04-01T00:00:00Z'),
        dueDate: new Date('2026-04-01T00:00:00Z'),
      });
      expect(invoice?.lineItems).toEqual([
        expect.objectContaining({ kind: 'seat', userId: employee.userId, activeDays: 21, amountCents: 339 }),
      ]);
      const stored = await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId });
      expect(stored.currentPeriodStart.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(stored.currentPeriodEnd.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    });

    it('the new period bills the still-active employee for all of it', async () => {
      const { admin } = await basicWithEmployee();
      at('2026-04-01T00:10:00.000Z');
      await cycle();
      const session = await h.login(admin.email);

      const bill = await statement(session);

      expect(bill.period.start).toBe('2026-04-01T00:00:00.000Z');
      expect(bill.lineItems[0]).toMatchObject({ activeDays: 30, periodDays: 30, amountCents: 500 });
    });

    it('is idempotent: a second run bills nothing twice', async () => {
      const { companyId } = await basicWithEmployee();
      at('2026-04-01T00:10:00.000Z');

      await cycle();
      expect(await cycle()).toEqual({ companiesRolled: 0, invoicesFinalized: 0, failures: 0 });

      expect(await invoices(companyId)).toHaveLength(1);
      await h.drainTasks();
      expect(h.mail.sent).toHaveLength(2 + 1); // activation + invite + ONE invoice
    });

    it('two runs at the same moment still produce one invoice', async () => {
      const { companyId } = await basicWithEmployee();
      at('2026-04-01T00:10:00.000Z');

      const [first, second] = await Promise.all([cycle(), cycle()]);

      expect(first.invoicesFinalized + second.invoicesFinalized).toBe(1);
      expect(first.failures + second.failures).toBe(0);
      expect(await invoices(companyId)).toHaveLength(1);
    });

    it('catches up several missed periods, one invoice each, in order', async () => {
      const { companyId } = await company('premium');
      at('2026-06-02T09:00:00.000Z'); // the job has not run since March

      expect(await cycle()).toEqual({ companiesRolled: 1, invoicesFinalized: 3, failures: 0 });

      const rows = await invoices(companyId);
      expect(rows.map((row) => row.periodStart.toISOString().slice(0, 10))).toEqual(['2026-03-01', '2026-04-01', '2026-05-01']);
      expect(rows.map((row) => row.totalCents)).toEqual([30_000, 30_000, 30_000]);
      const stored = await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId });
      expect(stored.currentPeriodStart.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });

    it('bills a Premium period’s overage', async () => {
      const { companyId } = await company('premium');
      await h.seedUsage(companyId, 1_040, '2026-03-01');
      at('2026-04-01T00:10:00.000Z');

      await cycle();

      const [invoice] = await invoices(companyId);
      expect(invoice?.totalCents).toBe(32_000); // 30000 + 40 × 50
    });

    it('emails the billing address, and only when there is something to pay', async () => {
      const free = await company('free'); // before the clock moves: its period is also March
      const paying = await basicWithEmployee();
      at('2026-04-01T00:10:00.000Z');
      h.mail.clear();

      await cycle();
      await h.drainTasks();

      const mail = h.mail.latestTo(paying.admin.email);
      expect(mail?.subject).toBe('Your Gridline invoice for 2026-03-01 – 2026-04-01');
      expect(mail?.text).toContain('$3.39');
      const [invoice] = await invoices(paying.companyId);
      expect(mail?.text).toContain(`/billing/invoices/${invoice?.id}`);
      // A $0 invoice is written and audited, but nobody is emailed about it.
      expect(h.mail.to(free.admin.email)).toEqual([]);
      expect(await invoices(free.companyId)).toHaveLength(1);
    });

    it('writes a system audit entry per invoice', async () => {
      const { companyId } = await basicWithEmployee();
      at('2026-04-01T00:10:00.000Z');

      await cycle();

      const entries = await h.dataSource
        .getRepository(AuditLogEntry)
        .find({ where: { companyId, action: 'billing.invoice_finalized' } });
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ actorUserId: null, targetType: 'invoice' });
      expect(entries[0]?.metadata).toMatchObject({ totalCents: 339, plan: 'basic' });
    });

    it('one company failing does not stop the others being billed', async () => {
      const broken = await company('premium');
      const healthy = await company('premium');
      at('2026-04-01T00:10:00.000Z');
      const invoicing = h.app.get(InvoicingService);
      const original = invoicing.rollForward.bind(invoicing);
      vi.spyOn(invoicing, 'rollForward').mockImplementation(async (manager, subscription, now) => {
        if (subscription.companyId === broken.companyId) throw new Error('boom');
        return original(manager, subscription, now);
      });

      const result = await cycle();
      vi.restoreAllMocks();

      expect(result).toEqual({ companiesRolled: 1, invoicesFinalized: 1, failures: 1 });
      expect(await invoices(healthy.companyId)).toHaveLength(1);
      expect(await invoices(broken.companyId)).toEqual([]);
      // The failed company's transaction rolled back completely: it is still due, so tomorrow retries it.
      expect((await cycle()).invoicesFinalized).toBe(1);
      expect(await invoices(broken.companyId)).toHaveLength(1);
    });

    it('serialises per company: with the subscription row locked elsewhere, the cycle waits', async () => {
      const { companyId } = await company('premium');
      at('2026-04-01T00:10:00.000Z');
      const holder = h.dataSource.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      try {
        await holder.query('SELECT id FROM subscription WHERE "companyId" = $1 FOR UPDATE', [companyId]);

        let settled = false;
        const pending = cycle().then((result) => {
          settled = true;
          return result;
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        expect(settled).toBe(false);

        await holder.rollbackTransaction();
        expect((await pending).invoicesFinalized).toBe(1);
      } finally {
        if (holder.isTransactionActive) await holder.rollbackTransaction();
        await holder.release();
      }
      expect(await invoices(companyId)).toHaveLength(1);
    });

    it('is unaffected by another company’s billing dates', async () => {
      const early = await company('premium');
      at('2026-03-15T12:00:00.000Z');
      const laterAdmin = await h.registerAndActivate();
      const laterSession = await h.login(laterAdmin.email);
      await h.subscribe(laterSession, 'premium'); // anchored on the 15th
      at('2026-04-01T00:10:00.000Z');

      await cycle();

      expect(await invoices(early.companyId)).toHaveLength(1);
      expect(await invoices(laterAdmin.companyId)).toEqual([]);
    });
  });

  describe('plan changes announce their invoices too', () => {
    it('upgrading mid-period emails the closing invoice when there is something to pay', async () => {
      const { admin, companyId } = await company('basic');
      at('2026-03-11T12:00:00.000Z');
      const session = await h.login(admin.email);
      await h.inviteAndAccept(session, companyId);
      at('2026-03-21T12:00:00.000Z');
      const later = await h.login(admin.email);
      h.mail.clear();

      await h.http().patch('/subscriptions/me').set(...h.bearer(later)).send({ plan: 'premium' }).expect(200);
      await h.drainTasks();

      const mail = h.mail.latestTo(admin.email);
      expect(mail?.subject).toContain('2026-03-01 – 2026-03-21');
      expect(await h.dataSource.getRepository(AuditLogEntry).count({ where: { companyId, action: 'billing.invoice_finalized' } })).toBe(1);
    });

    it('an email is queued only if the invoice commits', async () => {
      const { admin, companyId } = await company('basic');
      at('2026-03-11T12:00:00.000Z');
      const session = await h.login(admin.email);
      await h.inviteAndAccept(session, companyId);
      await h.drainTasks();
      at('2026-04-01T00:10:00.000Z');
      const invoicing = h.app.get(InvoicingService);
      const original = invoicing.rollForward.bind(invoicing);
      vi.spyOn(invoicing, 'rollForward').mockImplementation(async (manager, subscription, now) => {
        await original(manager, subscription, now);
        throw new Error('fail after the invoice and its email were written');
      });

      await cycle();
      vi.restoreAllMocks();

      expect(await invoices(companyId)).toEqual([]);
      expect(await h.dataSource.getRepository(BackgroundTask).count({ where: { status: 'pending' } })).toBe(0);
    });
  });

  // ---- reading invoices ---------------------------------------------------

  describe('GET /billing/invoices', () => {
    async function threeInvoices() {
      const base = await company('premium');
      at('2026-06-02T09:00:00.000Z');
      await cycle();
      return { ...base, session: await h.login(base.admin.email) };
    }

    it('lists a company’s invoices, newest period first, with page metadata', async () => {
      const { session } = await threeInvoices();

      const first = invoicePage.parse((await h.http().get('/billing/invoices').set(...h.bearer(session)).query({ limit: 2 }).expect(200)).body);
      const second = invoicePage.parse((await h.http().get('/billing/invoices').set(...h.bearer(session)).query({ limit: 2, page: 2 }).expect(200)).body);

      expect(first.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
      expect(first.data.map((row) => row.periodStart.slice(0, 10))).toEqual(['2026-05-01', '2026-04-01']);
      expect(second.data.map((row) => row.periodStart.slice(0, 10))).toEqual(['2026-03-01']);
    });

    it('returns an empty page for a company with no invoices yet', async () => {
      const { session } = await company('premium');
      const page = invoicePage.parse((await h.http().get('/billing/invoices').set(...h.bearer(session)).expect(200)).body);

      expect(page.data).toEqual([]);
      expect(page.meta.total).toBe(0);
    });

    it('never lists another company’s invoices', async () => {
      const mine = await threeInvoices();
      const other = await company('premium');

      const page = invoicePage.parse((await h.http().get('/billing/invoices').set(...h.bearer(other.session)).expect(200)).body);

      expect(page.data).toEqual([]);
      expect((await invoices(mine.companyId)).length).toBe(3);
    });

    it.each([{ page: 0 }, { limit: 0 }, { limit: 101 }, { page: 'x' }, { companyId: randomUUID() }])('rejects %j', async (query) => {
      const { session } = await company();
      await h.http().get('/billing/invoices').set(...h.bearer(session)).query(query).expect(400);
    });
  });

  describe('GET /billing/invoices/:id', () => {
    it('returns one invoice with its line items', async () => {
      const { admin, companyId } = await company('premium');
      await h.seedUsage(companyId, 1_005, '2026-03-01');
      at('2026-04-01T00:10:00.000Z');
      await cycle();
      const session = await h.login(admin.email);
      const [row] = await invoices(companyId);

      const invoice = invoiceSchema.parse((await h.http().get(`/billing/invoices/${row?.id}`).set(...h.bearer(session)).expect(200)).body);

      expect(invoice.totalCents).toBe(30_250);
      expect(invoice.lineItems.map((line) => line.kind)).toEqual(['plan_base', 'overage']);
    });

    it('another company’s invoice is a 404, and a malformed id a 400', async () => {
      const mine = await company('premium');
      at('2026-04-01T00:10:00.000Z');
      await cycle();
      const other = await company('premium');
      const [row] = await invoices(mine.companyId);

      await h.http().get(`/billing/invoices/${row?.id}`).set(...h.bearer(other.session)).expect(404);
      await h.http().get(`/billing/invoices/${randomUUID()}`).set(...h.bearer(other.session)).expect(404);
      await h.http().get('/billing/invoices/nope').set(...h.bearer(other.session)).expect(400);
    });

    it('an invoice does not change after the fact: it keeps the plan and lines it was issued with', async () => {
      const { admin, companyId } = await company('premium');
      at('2026-04-01T00:10:00.000Z');
      await cycle();
      const [row] = await invoices(companyId);
      let session = await h.login(admin.email);
      await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' }).expect(200);
      session = await h.login(admin.email);

      const invoice = invoiceSchema.parse((await h.http().get(`/billing/invoices/${row?.id}`).set(...h.bearer(session)).expect(200)).body);

      expect(invoice).toMatchObject({ plan: 'premium', totalCents: 30_000 });
    });
  });
});
