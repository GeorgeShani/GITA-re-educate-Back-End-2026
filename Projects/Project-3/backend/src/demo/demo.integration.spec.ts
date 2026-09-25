import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { IsNull } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { ApiKey } from '#/api-keys/api-key.entity.js';
import { generateApiKey } from '#/api-keys/api-key-token.js';
import { parseLineItems } from '#/billing/line-item.schema.js';
import { Invoice } from '#/billing/invoice.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { DemoSeedService } from './demo-seed.service.js';
import { DEMO_ADMIN, DEMO_COMPANY, DEMO_EMPLOYEES, DEMO_FILES } from './demo-data.js';
import { DEMO_READ_ONLY_MESSAGE } from './demo-read-only.guard.js';

describe('demo mode (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  const seed = () => h.app.get(DemoSeedService).seed();

  /** Every object under the temp storage root, so a seed that writes bytes and then rolls back is caught. */
  async function storedObjects(): Promise<string[]> {
    const entries = await readdir(h.storageDir, { recursive: true, withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name)).sort();
  }

  async function demoSession(): Promise<SessionBody> {
    const response = await h.http().post('/auth/demo').expect(200);
    return h.parseSession(response.body);
  }

  describe('before the demo is seeded', () => {
    it('POST /auth/demo answers 404 and says how to fix it', async () => {
      const response = await h.http().post('/auth/demo').expect(404);
      expect(response.body.message).toContain('seed:demo');
    });
  });

  describe('seeding', () => {
    it('builds the whole company: plan, people, files with ready reports, an invoice, an audit trail', async () => {
      const result = await seed();
      expect(result.created).toBe(true);

      const company = await h.dataSource.getRepository(Company).findOneByOrFail({ id: result.companyId });
      expect(company).toMatchObject({ isDemo: true, status: 'active', name: DEMO_COMPANY.name });

      const users = await h.dataSource.getRepository(User).find({ where: { companyId: company.id } });
      expect(users).toHaveLength(1 + DEMO_EMPLOYEES.length);
      expect(users.every((user) => user.status === 'active')).toBe(true);
      expect(users.find((user) => user.role === 'admin')?.email).toBe(DEMO_ADMIN.email);

      const files = await h.dataSource.getRepository(FileAsset).find({ where: { companyId: company.id } });
      expect(files).toHaveLength(DEMO_FILES.length);
      // The bytes are really in storage, so downloads work.
      for (const file of files) expect((await h.storage.get(file.storageKey)).length).toBe(file.sizeBytes);

      const invoices = await h.dataSource.getRepository(Invoice).find({ where: { companyId: company.id } });
      expect(invoices).toHaveLength(1);
      const [invoice] = invoices;
      expect(invoice?.plan).toBe('basic');
      // The real calculator produced it: one seat line per employee, and the total is their sum.
      const lines = parseLineItems(invoice?.lineItems);
      expect(lines).toHaveLength(DEMO_EMPLOYEES.length);
      expect(lines.reduce((sum, line) => sum + line.amountCents, 0)).toBe(invoice?.totalCents);
      expect(invoice?.totalCents).toBeGreaterThan(0);

      const actions = (await h.dataSource.getRepository(AuditLogEntry).find({ where: { companyId: company.id } })).map((entry) => entry.action);
      expect(actions).toEqual(expect.arrayContaining(['subscription.created', 'employee.invited', 'employee.accepted_invite', 'file.uploaded', 'billing.invoice_finalized']));
    });

    it('is idempotent: a second (or concurrent) run changes nothing, and leaves no stray stored files', async () => {
      const first = await seed();
      const storedBefore = await storedObjects();
      const [second, third] = await Promise.all([seed(), seed()]);

      expect(second).toEqual({ created: false, companyId: first.companyId });
      expect(third).toEqual({ created: false, companyId: first.companyId });
      expect(await h.dataSource.getRepository(Company).count({ where: { isDemo: true } })).toBe(1);
      expect(await h.dataSource.getRepository(FileAsset).count()).toBe(DEMO_FILES.length);
      expect(await h.dataSource.getRepository(Invoice).count()).toBe(1);
      expect(await storedObjects()).toEqual(storedBefore);
    });

    it('never queues an email for the demo company’s invoice', async () => {
      await seed();
      const tasks = await h.dataSource.getRepository(BackgroundTask).find();
      expect(tasks.filter((task) => task.type === 'send_email')).toEqual([]);
    });
  });

  describe('with ordinary companies already on the server', () => {
    it('signs in the DEMO company’s admin, not someone else’s', async () => {
      // Registered BEFORE the seed, so they come first in any unordered lookup.
      await h.registerAndActivate();
      await h.registerAndActivate();
      await seed();

      const session = await demoSession();
      const me = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(me.body.company.name).toBe(DEMO_COMPANY.name);
    });
  });

  describe('the demo session', () => {
    beforeEach(async () => {
      await seed();
    });

    it('logs in as the demo admin without a password, and can refresh', async () => {
      const session = await demoSession();
      const me = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(me.body.user.email).toBe(DEMO_ADMIN.email);
      expect(me.body.company.name).toBe(DEMO_COMPANY.name);

      await h.http().post('/auth/refresh').send({ refreshToken: session.refreshToken }).expect(200);
    });

    it('can read everything a visitor would want to explore', async () => {
      const session = await demoSession();
      const auth = h.bearer(session);

      const files = await h.http().get('/files').set(...auth).expect(200);
      expect(files.body.data).toHaveLength(DEMO_FILES.length);

      const first = files.body.data[0];
      const report = await h.http().get(`/files/${first.id}/report`).set(...auth).expect(200);
      expect(report.body.status).toBe('ready');
      expect(report.body.metrics.rowCount).toBeGreaterThan(0);
      const preview = await h.http().get(`/files/${first.id}/preview`).set(...auth).expect(200);
      expect(preview.body.rows.length).toBeGreaterThan(0);
      await h.http().get(`/files/${first.id}/download`).set(...auth).expect(200);

      const employees = await h.http().get('/employees').set(...auth).expect(200);
      expect(employees.body.meta.total).toBe(1 + DEMO_EMPLOYEES.length);
      const subscription = await h.http().get('/subscriptions/me').set(...auth).expect(200);
      expect(subscription.body.plan).toBe('basic');
      const invoices = await h.http().get('/billing/invoices').set(...auth).expect(200);
      expect(invoices.body.meta.total).toBe(1);
      await h.http().get('/billing/current').set(...auth).expect(200);
      await h.http().get('/audit').set(...auth).expect(200);
      await h.http().get('/analytics/usage').set(...auth).expect(200);
    });

    it('refuses every write with the reason, whatever the route', async () => {
      const session = await demoSession();
      const auth = h.bearer(session);
      const files = await h.http().get('/files').set(...auth).expect(200);
      const fileId = files.body.data[0].id;
      const employees = await h.http().get('/employees').set(...auth).expect(200);
      const employeeId = employees.body.data.find((row: { role: string }) => row.role === 'employee').id;

      const attempts = [
        () => h.upload(session),
        () => h.http().patch(`/files/${fileId}`).set(...auth).send({ visibility: 'company' }),
        () => h.http().delete(`/files/${fileId}`).set(...auth),
        () => h.http().post('/employees').set(...auth).send({ email: 'new@demo.test', fullName: 'New Person' }),
        () => h.http().delete(`/employees/${employeeId}`).set(...auth),
        () => h.http().patch('/subscriptions/me').set(...auth).send({ plan: 'premium' }),
        () => h.http().patch('/companies/me').set(...auth).send({ name: 'Hijacked' }),
        () => h.http().patch('/users/me').set(...auth).send({ fullName: 'Hijacked' }),
        () => h.http().post('/api-keys').set(...auth).send({ name: 'k', scopes: ['files:read'] }),
        () => h.http().patch('/auth/password').set(...auth).send({ currentPassword: 'x', newPassword: 'another-password-9' }),
      ];
      for (const attempt of attempts) {
        const response = await attempt();
        expect(response.status).toBe(403);
        expect(response.body.message).toBe(DEMO_READ_ONLY_MESSAGE);
      }

      // Nothing changed.
      expect(await h.dataSource.getRepository(FileAsset).count({ where: { deletedAt: IsNull() } })).toBe(DEMO_FILES.length);
      expect((await h.dataSource.getRepository(Company).findOneByOrFail({ isDemo: true })).name).toBe(DEMO_COMPANY.name);
    });

    it('the demo admin sees the restricted file too (an admin sees everything in the company)', async () => {
      const session = await demoSession();
      const files = await h.http().get('/files').set(...h.bearer(session)).expect(200);
      expect(files.body.data.some((file: { originalName: string }) => file.originalName === 'payroll-draft.csv')).toBe(true);
    });

    it('an API key of the demo company can read but not write', async () => {
      const admin = await h.dataSource.getRepository(User).findOneByOrFail({ email: DEMO_ADMIN.email });
      const { plaintext, prefix, hash } = generateApiKey();
      await h.dataSource.getRepository(ApiKey).insert({
        companyId: admin.companyId,
        createdByUserId: admin.id,
        name: 'demo key',
        prefix,
        keyHash: hash,
        scopes: ['files:read', 'files:write'],
      });

      await h.http().get('/files').set('Authorization', `Bearer ${plaintext}`).expect(200);
      const refused = await h.upload(await demoSession(), { bearer: plaintext }).expect(403);
      expect(refused.body.message).toBe(DEMO_READ_ONLY_MESSAGE);
    });

    it('does not affect an ordinary company on the same server', async () => {
      const account = await h.registerAndActivate();
      const session = await h.login(account.email);
      await h.subscribe(session, 'basic');
      await h.upload(session).expect(201);
      await h.http().patch('/companies/me').set(...h.bearer(session)).send({ name: 'Renamed' }).expect(200);
    });
  });
});
