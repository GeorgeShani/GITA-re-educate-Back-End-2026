import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, type RegisteredAccount } from '#test/support/app-harness.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';

describe('profile: GET /auth/me, PATCH /users/me, PATCH /companies/me (integration)', () => {
  let h: AppHarness;
  let admin: RegisteredAccount;
  let adminSession: Awaited<ReturnType<AppHarness['login']>>;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    admin = await h.registerAndActivate({ companyName: 'Acme' });
    adminSession = await h.login(admin.email);
  });

  afterAll(() => h.stop());

  describe('GET /auth/me', () => {
    it('returns the user and the company, and nothing credential-shaped', async () => {
      const response = await h.http().get('/auth/me').set(...h.bearer(adminSession)).expect(200);

      expect(Object.keys(response.body).sort()).toEqual(['company', 'user']);
      expect(Object.keys(response.body.user).sort()).toEqual([
        'activatedAt',
        'email',
        'fullName',
        'id',
        'role',
        'status',
      ]);
      expect(Object.keys(response.body.company).sort()).toEqual([
        'activatedAt',
        'billingEmail',
        'country',
        'id',
        'industry',
        'name',
        'status',
      ]);
      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|tokenHash|scrypt/);
    });

    it('reports the caller, not someone else in the same company', async () => {
      const employee = await h.seedEmployee(admin.companyId, { fullName: 'Nino Employee' });
      const session = await h.login(employee.email);

      const response = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);

      expect(response.body.user).toMatchObject({ id: employee.userId, role: 'employee', fullName: 'Nino Employee' });
    });
  });

  describe('PATCH /users/me', () => {
    it('changes the caller’s own name', async () => {
      const response = await h
        .http()
        .patch('/users/me')
        .set(...h.bearer(adminSession))
        .send({ fullName: '  Giorgi Shanidze ' })
        .expect(200);

      expect(response.body).toMatchObject({ id: admin.userId, fullName: 'Giorgi Shanidze' });
      const me = await h.http().get('/auth/me').set(...h.bearer(adminSession)).expect(200);
      expect(me.body.user.fullName).toBe('Giorgi Shanidze');
    });

    it('is open to employees, not just admins', async () => {
      const employee = await h.seedEmployee(admin.companyId);
      const session = await h.login(employee.email);

      await h.http().patch('/users/me').set(...h.bearer(session)).send({ fullName: 'New Name' }).expect(200);
    });

    it.each([
      ['a blank name', { fullName: '   ' }],
      ['a missing name', {}],
      ['an over-long name', { fullName: 'x'.repeat(200) }],
    ])('rejects %s', async (_name, body) => {
      await h.http().patch('/users/me').set(...h.bearer(adminSession)).send(body).expect(400);
    });

    it('will not let anyone smuggle in a role, status or other person’s id', async () => {
      const employee = await h.seedEmployee(admin.companyId);
      const session = await h.login(employee.email);

      await h.http().patch('/users/me').set(...h.bearer(session)).send({ fullName: 'X', role: 'admin' }).expect(400);
      await h.http().patch('/users/me').set(...h.bearer(session)).send({ fullName: 'X', id: admin.userId }).expect(400);

      const stored = await h.dataSource.getRepository(User).findOneByOrFail({ id: employee.userId });
      expect(stored.role).toBe('employee');
    });

    it('audits the change', async () => {
      await h.http().patch('/users/me').set(...h.bearer(adminSession)).send({ fullName: 'Someone' }).expect(200);

      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({
        action: 'user.profile_updated',
      });
      expect(entry).toMatchObject({ actorUserId: admin.userId, companyId: admin.companyId });
    });
  });

  describe('PATCH /companies/me', () => {
    it('lets an admin change every field', async () => {
      const response = await h
        .http()
        .patch('/companies/me')
        .set(...h.bearer(adminSession))
        .send({ name: 'Acme Global', country: 'us', industry: 'finance', billingEmail: 'Billing@Acme.test' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: admin.companyId,
        name: 'Acme Global',
        country: 'US',
        industry: 'finance',
        billingEmail: 'billing@acme.test',
      });
    });

    it('changes only the fields named', async () => {
      await h.http().patch('/companies/me').set(...h.bearer(adminSession)).send({ name: 'Renamed' }).expect(200);

      const company = await h.dataSource.getRepository(Company).findOneByOrFail({ id: admin.companyId });
      expect(company).toMatchObject({ name: 'Renamed', country: 'GE', industry: 'technology' });
    });

    it('is admin-only: an employee gets 403 and nothing changes', async () => {
      const employee = await h.seedEmployee(admin.companyId);
      const session = await h.login(employee.email);

      await h.http().patch('/companies/me').set(...h.bearer(session)).send({ name: 'Hijacked' }).expect(403);

      const company = await h.dataSource.getRepository(Company).findOneByOrFail({ id: admin.companyId });
      expect(company.name).toBe('Acme');
    });

    it('rejects an empty update', async () => {
      const response = await h.http().patch('/companies/me').set(...h.bearer(adminSession)).send({}).expect(400);

      expect(response.body.message).toMatch(/no fields/i);
    });

    it.each([
      ['a name that is too short', { name: 'A' }],
      ['a bad country', { country: 'Georgia' }],
      ['an unknown industry', { industry: 'piracy' }],
      ['a malformed billing email', { billingEmail: 'nope' }],
    ])('rejects %s', async (_name, body) => {
      await h.http().patch('/companies/me').set(...h.bearer(adminSession)).send(body).expect(400);
    });

    it('rejects a billing email another company already uses (409)', async () => {
      const other = await h.registerAndActivate({ companyName: 'Rival' });

      await h
        .http()
        .patch('/companies/me')
        .set(...h.bearer(adminSession))
        .send({ billingEmail: other.email })
        .expect(409);
    });

    it('lets a company keep or re-set its own billing email', async () => {
      await h
        .http()
        .patch('/companies/me')
        .set(...h.bearer(adminSession))
        .send({ billingEmail: admin.email })
        .expect(200);
    });

    it('always updates the CALLER’s company and cannot be pointed at another tenant', async () => {
      const rival = await h.registerAndActivate({ companyName: 'Rival' });

      // The id in the body is refused outright…
      await h
        .http()
        .patch('/companies/me')
        .set(...h.bearer(adminSession))
        .send({ id: rival.companyId, name: 'Pwned' })
        .expect(400);
      await h
        .http()
        .patch('/companies/me')
        .set(...h.bearer(adminSession))
        .send({ companyId: rival.companyId, name: 'Pwned' })
        .expect(400);

      // …and a legitimate update touches only the caller's own row.
      await h.http().patch('/companies/me').set(...h.bearer(adminSession)).send({ name: 'Mine Only' }).expect(200);

      const rows = await h.dataSource.getRepository(Company).find();
      expect(rows.find((c) => c.id === admin.companyId)?.name).toBe('Mine Only');
      expect(rows.find((c) => c.id === rival.companyId)?.name).toBe('Rival');
    });

    it('audits which fields changed, not their values', async () => {
      await h
        .http()
        .patch('/companies/me')
        .set(...h.bearer(adminSession))
        .send({ name: 'Audited', country: 'DE' })
        .expect(200);

      const entry = await h.dataSource.getRepository(AuditLogEntry).findOneByOrFail({
        action: 'company.updated',
      });
      expect(entry.metadata).toEqual({ fields: ['name', 'country'] });
      expect(entry).toMatchObject({ actorUserId: admin.userId, companyId: admin.companyId });
    });
  });
});
