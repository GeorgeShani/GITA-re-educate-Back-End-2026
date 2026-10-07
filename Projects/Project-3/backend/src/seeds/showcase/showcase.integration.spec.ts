import { mkdtemp, readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IsNull } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness } from '#test/support/app-harness.js';
import { PasswordHasher } from '#/auth/crypto/password-hasher.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK } from '#/core/clock/clock.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { BillingAccount } from '#/payments/billing-account.entity.js';
import { BillingSyncService } from '#/payments/billing-sync.service.js';
import { SeatSync } from '#/payments/seat-sync.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { SubscriptionsService } from '#/subscriptions/subscriptions.service.js';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';
import { Credentials } from './credentials.js';
import { type ContentRunResult, ShowcaseRunner } from './runner.js';
import { SHOWCASE, addressFor, billingAddressFor } from './plan.js';

const MAILBOX = 'owner@gmail.com';

describe('the showcase seed (integration)', () => {
  let h: AppHarness;
  let api: string;
  let dir: string;
  let credentialsPath: string;
  const lines: string[] = [];

  beforeAll(async () => {
    h = await AppHarness.start({ payments: true });
    await h.app.listen(0);
    api = `http://127.0.0.1:${(h.app.getHttpServer().address() as AddressInfo).port}`;
  }, 120_000);
  beforeEach(async () => {
    await h.reset();
    dir = await mkdtemp(join(tmpdir(), 'gridline-showcase-'));
    credentialsPath = join(dir, 'creds.json');
    lines.length = 0;
  });
  afterAll(async () => {
    await h.stop();
  });

  const runner = () =>
    new ShowcaseRunner({
      dataSource: h.dataSource,
      hasher: new PasswordHasher(),
      config: h.app.get(APP_CONFIG),
      clock: h.app.get(CLOCK),
      audit: h.app.get(AuditService),
      subscriptions: h.app.get(SubscriptionsService),
      billingSync: h.app.get(BillingSyncService),
      log: (line) => void lines.push(line),
      apiOptions: { signInGapMs: 0, retries: 1, sleep: async () => undefined },
      pollMs: 50,
    });

  const company = (slug: string) => h.dataSource.getRepository(Company).findOneByOrFail({ billingEmail: billingAddressFor(MAILBOX, slug) });

  /** What a completed Checkout leaves behind: the paid plan, and a Stripe customer and subscription for it. */
  async function completeCheckout(slug: string, plan: 'basic' | 'premium'): Promise<void> {
    const { id: companyId } = await company(slug);
    await h.dataSource.getRepository(Subscription).update({ companyId }, { plan });
    await h.dataSource.getRepository(BillingAccount).insert({
      companyId,
      stripeCustomerId: `cus_${slug}`,
      stripeSubscriptionId: `sub_${slug}`,
      stripeSeatItemId: null,
      status: 'current',
      graceEndsAt: null,
      pendingIntentId: null,
      pendingCheckoutSessionId: null,
      pendingPlan: null,
      pendingCreatedAt: null,
      seatRevision: 0,
    });
  }

  /** Stands in for the running API's task runner: cleaning, reports and emails are background work there. */
  function startWorker(): () => Promise<void> {
    let running = true;
    const loop = (async () => {
      while (running) {
        await h.drainTasks().catch(() => undefined);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    })();
    return async () => {
      running = false;
      await loop;
    };
  }

  const args = () => ({ mailbox: MAILBOX, credentialsPath, confirmProduction: false, api, skipAi: false });

  async function runContent(): Promise<ContentRunResult> {
    const stop = startWorker();
    try {
      return await runner().content(args());
    } finally {
      await stop();
    }
  }

  const counts = async () => ({
    companies: await h.dataSource.getRepository(Company).count(),
    users: await h.dataSource.getRepository(User).count(),
    files: await h.dataSource.getRepository(FileAsset).count(),
    seatIntervals: await h.dataSource.getRepository(SeatInterval).count(),
    seatSyncs: await h.dataSource.getRepository(SeatSync).count(),
    audit: Number((await h.dataSource.query('SELECT count(*) FROM audit_log_entry'))[0].count),
    rules: Number((await h.dataSource.query('SELECT count(*) FROM quality_rule'))[0].count),
    comments: Number((await h.dataSource.query('SELECT count(*) FROM file_comment'))[0].count),
  });

  it('creates the three companies on Free, with admins who can sign in, and is idempotent', async () => {
    await runner().accounts(args());

    const companies = await h.dataSource.getRepository(Company).find({ order: { name: 'ASC' } });
    expect(companies.map((row) => row.name)).toEqual(['Kavkasia Retail', 'Meridian Clinics', 'Northwind Logistics']);
    expect(companies.every((row) => row.status === 'active' && !row.isDemo)).toBe(true);
    for (const { id } of companies) {
      expect((await h.dataSource.getRepository(Subscription).findOneByOrFail({ companyId: id })).plan).toBe('free');
    }

    const credentials = await Credentials.open(credentialsPath, MAILBOX);
    for (const spec of SHOWCASE) {
      const admin = credentials.find(spec.slug, addressFor(MAILBOX, spec.slug, spec.admin.fullName));
      expect(admin?.password).toHaveLength(20);
      const session = await h.login(admin!.email, admin!.password);
      const me = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(me.body.company.name).toBe(spec.name);
    }

    const before = await counts();
    await runner().accounts(args());
    expect(await counts()).toEqual(before);
  });

  it('refuses to touch a production database without --confirm-production', async () => {
    const production = new ShowcaseRunner({
      dataSource: h.dataSource,
      hasher: new PasswordHasher(),
      config: { isProduction: true },
      clock: h.app.get(CLOCK),
      audit: h.app.get(AuditService),
      subscriptions: h.app.get(SubscriptionsService),
      billingSync: h.app.get(BillingSyncService),
      log: () => undefined,
    });

    await expect(production.accounts(args())).rejects.toThrow(/--confirm-production/);
    expect(await h.dataSource.getRepository(Company).count()).toBe(0);
    await production.accounts({ ...args(), confirmProduction: true });
    expect(await h.dataSource.getRepository(Company).count()).toBe(3);
  });

  it('stops, and says why, until the paid companies have been upgraded through Checkout', async () => {
    await runner().accounts(args());

    const blocked = await runner().content(args());

    expect(blocked.summaries).toEqual([]);
    expect(blocked.blocked).toHaveLength(2);
    expect(blocked.blocked.join('\n')).toMatch(/Northwind Logistics is on free, not basic.*Checkout/);
    expect(blocked.blocked.join('\n')).toMatch(/Meridian Clinics is on free, not premium/);
    expect((await counts()).files).toBe(0);
  });

  it('stops when a paid plan is not backed by a Stripe subscription', async () => {
    await runner().accounts(args());
    await h.dataSource.getRepository(Subscription).update({ companyId: (await company('northwind')).id }, { plan: 'basic' });
    await completeCheckout('meridian', 'premium');

    const blocked = await runner().content(args());

    expect(blocked.blocked).toEqual([expect.stringMatching(/Northwind Logistics is on basic, but not through a Stripe subscription/)]);
  });

  describe('the content stage', () => {
    beforeEach(async () => {
      await runner().accounts(args());
      await completeCheckout('northwind', 'basic');
      await completeCheckout('meridian', 'premium');
      for (let plan = 0; plan < 5; plan += 1) h.ai.nextPlan({ ok: true, spec: { filters: [], groupBy: [], measures: [{ fn: 'count' }], limit: 50 } });
    });

    it('seeds people, files, versions, rules, comments and questions through the real API, and a second run adds nothing', async () => {
      const first = await runContent();

      expect(first.blocked).toEqual([]);
      expect(first.summaries.flatMap((summary) => summary.failures)).toEqual([]);
      const byCompany = Object.fromEntries(first.summaries.map((summary) => [summary.slug, summary]));
      expect(byCompany.northwind).toMatchObject({ uploaded: 7, versions: 2, cleaned: true, invited: true, removed: 1 });
      expect(byCompany.meridian).toMatchObject({ uploaded: 8, versions: 1, cleaned: true });
      expect(byCompany.kavkasia).toMatchObject({ uploaded: 5, versions: 1, cleaned: true });
      // Rules, conversation, and the queries (two built by hand and two put to the assistant for each paid company).
      expect(byCompany.northwind).toMatchObject({ rules: 5, comments: 4, queries: 4 });
      expect(byCompany.meridian).toMatchObject({ rules: 6, comments: 5, queries: 4 });
      expect(byCompany.kavkasia).toMatchObject({ rules: 3, comments: 0, queries: 2 });
      expect(h.ai.planCalls).toHaveLength(5);

      // People: the roster as planned, and never more seats than the plan allows.
      const northwind = await company('northwind');
      const people = await h.dataSource.getRepository(User).find({ where: { companyId: northwind.id } });
      const statusOf = (name: string) => people.find((person) => person.fullName === name)?.status;
      expect(people.filter((person) => person.role === 'employee' && person.status === 'active')).toHaveLength(6);
      expect(statusOf('Nika Tsereteli')).toBe('disabled');
      expect(statusOf('Irakli Mgaloblishvili')).toBe('invited');
      expect(people.filter((person) => person.role === 'employee' && ['active', 'invited'].includes(person.status)).length).toBeLessThanOrEqual(PLAN_CATALOG.basic.maxEmployees!);
      expect(h.mail.latestTo(addressFor(MAILBOX, 'northwind', 'Irakli Mgaloblishvili'))).toBeDefined();

      // Seats: an interval per person who ever held one (the removed one closed), a Stripe sync per change.
      const intervals = await h.dataSource.getRepository(SeatInterval).find({ where: { companyId: northwind.id } });
      expect(intervals).toHaveLength(7);
      expect(intervals.filter((interval) => interval.activeTo === null)).toHaveLength(6);
      expect(await h.dataSource.getRepository(SeatSync).count({ where: { companyId: northwind.id } })).toBe(8);
      const meridian = await company('meridian');
      expect(await h.dataSource.getRepository(SeatSync).count({ where: { companyId: meridian.id } })).toBe(7);
      const kavkasia = await company('kavkasia');
      expect(await h.dataSource.getRepository(SeatSync).count({ where: { companyId: kavkasia.id } })).toBe(0);
      expect(await h.dataSource.getRepository(User).count({ where: { companyId: kavkasia.id } })).toBe(1);

      // The trail matches what accepting an invitation writes.
      const trail = (await h.dataSource.query('SELECT action, count(*)::int AS n FROM audit_log_entry WHERE "companyId" = $1 GROUP BY action', [northwind.id])) as Array<{ action: string; n: number }>;
      const n = (action: string) => trail.find((row) => row.action === action)?.n ?? 0;
      expect(n('employee.accepted_invite')).toBe(7);
      expect(n('employee.invited')).toBe(8); // seven by the seed, one through the API
      expect(n('employee.disabled')).toBe(1);

      // Content: every dataset exists, the restricted one is restricted, the second versions and the cleaning are real.
      const admin = await h.login(addressFor(MAILBOX, 'northwind', 'Nino Beridze'), (await Credentials.open(credentialsPath, MAILBOX)).find('northwind', addressFor(MAILBOX, 'northwind', 'Nino Beridze'))!.password);
      const listed = (await h.http().get('/files?limit=100').set(...h.bearer(admin)).expect(200)).body.data as Array<{ id: string; originalName: string; version: number; visibility: string; datasetId: string }>;
      expect(listed.find((file) => file.originalName === 'driver-roster.csv')?.visibility).toBe('restricted');
      const shipments = listed.find((file) => file.originalName.startsWith('shipments-q3'));
      const versions = (await h.http().get(`/files/${shipments!.datasetId}/versions`).set(...h.bearer(admin)).expect(200)).body.data as Array<{ version: number; derivedFromFileId: string | null }>;
      expect(versions.filter((version) => version.derivedFromFileId === null)).toHaveLength(2);
      expect(versions.filter((version) => version.derivedFromFileId !== null)).toHaveLength(1);
      const settings = (await h.http().get(`/datasets/${shipments!.datasetId}/settings`).set(...h.bearer(admin)).expect(200)).body;
      expect(settings.keyColumns).toEqual(['shipment_id']);

      // The report is ready, and the second version was compared with the first row by row (the key column was saved first).
      const [newer, firstVersion] = [...versions].filter((version) => version.derivedFromFileId === null).sort((a, b) => b.version - a.version) as unknown as Array<{ id: string }>;
      const report = (await h.http().get(`/files/${newer!.id}/report`).set(...h.bearer(admin)).expect(200)).body;
      expect(report.status).toBe('ready');
      const rows = await h.http().get(`/files/${newer!.id}/compare/${firstVersion!.id}/rows`).set(...h.bearer(admin)).expect(200);
      expect(JSON.stringify(rows.body)).toMatch(/shipment_id/);

      // An employee sees the company's files but not the restricted one they were not granted.
      const seeded = await Credentials.open(credentialsPath, MAILBOX);
      const ninoEmployee = seeded.find('northwind', addressFor(MAILBOX, 'northwind', 'Giorgi Kapanadze'))!;
      const employee = await h.login(ninoEmployee.email, ninoEmployee.password);
      const seen = (await h.http().get('/files?limit=100').set(...h.bearer(employee)).expect(200)).body.data as Array<{ originalName: string }>;
      expect(seen.some((file) => file.originalName === 'driver-roster.csv')).toBe(false);
      expect(seen.some((file) => file.originalName === 'fleet-maintenance.xlsx')).toBe(true);

      // Passwords: in the local file in plain text, and nowhere else but as scrypt hashes.
      const markdown = await readFile(join(dir, 'creds.md'), 'utf8');
      const everyone = seeded.everyone();
      expect(everyone).toHaveLength(17); // 3 admins and 14 employees; the invited person has no password yet
      const hashes = await h.dataSource.getRepository(AuthIdentity).find();
      for (const person of everyone) {
        expect(markdown).toContain(person.password);
        for (const identity of hashes) expect(identity.passwordHash ?? '').not.toContain(person.password);
        for (const table of ['audit_log_entry', 'background_task', 'notification']) {
          const found = await h.dataSource.query(`SELECT 1 FROM ${table} WHERE position($1 in ${table}::text) > 0 LIMIT 1`, [person.password]);
          expect(found, `${table} must not hold a password`).toEqual([]);
        }
      }
      expect(hashes.every((identity) => (identity.passwordHash ?? '').startsWith('scrypt'))).toBe(true);
      for (const person of everyone.slice(0, 3)) await h.login(person.email, person.password);

      // A second run creates nothing.
      const before = await counts();
      const mailBefore = h.mail.sent.length;
      const second = await runContent();
      expect(second.summaries.flatMap((summary) => summary.failures)).toEqual([]);
      expect(second.summaries.map(({ uploaded, versions, rules, comments, queries, cleaned, invited, removed }) => ({ uploaded, versions, rules, comments, queries, cleaned, invited, removed }))).toEqual(
        second.summaries.map(() => ({ uploaded: 0, versions: 0, rules: 0, comments: 0, queries: 0, cleaned: false, invited: false, removed: 0 })),
      );
      expect(await counts()).toEqual(before);
      expect(h.mail.sent.length).toBe(mailBefore);
    }, 280_000);

    it('keeps a company within its plan: the Free company is limited to its quota and rule cap', async () => {
      await runContent();
      const kavkasia = await company('kavkasia');
      // Uploads are what the quota counts; the cleaned version is made, not uploaded.
      const uploads = await h.dataSource.getRepository(FileAsset).count({ where: { companyId: kavkasia.id, derivedFromFileId: IsNull() } });
      expect(uploads).toBe(6);
      expect(uploads).toBeLessThanOrEqual(PLAN_CATALOG.free.filesPerPeriod);
      expect(Number((await h.dataSource.query('SELECT count(*) FROM quality_rule WHERE "companyId" = $1', [kavkasia.id]))[0].count)).toBeLessThanOrEqual(3);
    }, 280_000);
  });
});
