import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { ApiKeyAuthenticationService, LAST_USED_GRANULARITY_MS } from '#/auth/api-key-authentication.service.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { ApiKey } from './api-key.entity.js';
import { MAX_ACTIVE_KEYS_PER_USER } from './api-keys.service.js';

describe('personal API keys (integration)', () => {
  let h: AppHarness;
  let admin: RegisteredAccount;
  let adminSession: SessionBody;
  let employee: RegisteredAccount & { session: SessionBody };

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    admin = await h.registerAndActivate();
    adminSession = await h.login(admin.email);
    await h.subscribe(adminSession, 'basic');
    employee = await h.inviteAndAccept(adminSession, admin.companyId);
  });

  afterAll(() => h.stop());

  const withKey = (key: string): [string, string] => ['Authorization', `Bearer ${key}`];
  const keys = () => h.dataSource.getRepository(ApiKey);
  const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

  async function auditRows(action: string): Promise<AuditLogEntry[]> {
    return h.dataSource.getRepository(AuditLogEntry).find({ where: { action }, order: { createdAt: 'ASC' } });
  }

  describe('creating a key', () => {
    it('returns the plaintext once and stores only its hash', async () => {
      const response = await h
        .http()
        .post('/api-keys')
        .set(...h.bearer(adminSession))
        .send({ name: '  Nightly import  ', scopes: ['files:read', 'files:write'] })
        .expect(201);

      const { key, id, prefix } = response.body;
      expect(key).toMatch(/^gl_live_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/);
      expect(key.startsWith(`${prefix}_`)).toBe(true);
      expect(response.body).toMatchObject({
        name: 'Nightly import',
        scopes: ['files:read', 'files:write'],
        createdByUserId: admin.userId,
        lastUsedAt: null,
        revokedAt: null,
      });
      expect(response.body).not.toHaveProperty('keyHash');

      const row = await keys().findOneByOrFail({ id });
      expect(row.keyHash).toBe(sha256(key));
      expect(JSON.stringify(row)).not.toContain(key);

      // Never again: the listing carries no secret, only the prefix.
      const listed = await h.http().get('/api-keys').set(...h.bearer(adminSession)).expect(200);
      expect(JSON.stringify(listed.body)).not.toContain(key);
      expect(listed.body.data[0]).not.toHaveProperty('key');
      expect(listed.body.data[0].prefix).toBe(prefix);
    });

    it('validates the body: a name and a non-empty, unique list of known scopes', async () => {
      const post = (body: object) =>
        h.http().post('/api-keys').set(...h.bearer(adminSession)).send(body);

      await post({ name: '', scopes: ['files:read'] }).expect(400);
      await post({ name: 'x'.repeat(81), scopes: ['files:read'] }).expect(400);
      await post({ name: 'k', scopes: [] }).expect(400);
      await post({ name: 'k', scopes: ['files:read', 'files:read'] }).expect(400);
      await post({ name: 'k', scopes: ['files:everything'] }).expect(400);
      await post({ name: 'k' }).expect(400);
      expect(await keys().count()).toBe(0);
    });

    it('never lets an employee grant billing:read, but lets an admin', async () => {
      const denied = await h
        .http()
        .post('/api-keys')
        .set(...h.bearer(employee.session))
        .send({ name: 'sneaky', scopes: ['files:read', 'billing:read'] })
        .expect(403);
      expect(denied.body.message).toMatch(/billing:read/);
      expect(await keys().count()).toBe(0);

      await h.createApiKey(adminSession, { scopes: ['billing:read'] });
    });

    it('needs a session: no token → 401, and a key cannot mint another key', async () => {
      await h.http().post('/api-keys').send({ name: 'k', scopes: ['files:read'] }).expect(401);

      const { key } = await h.createApiKey(adminSession, { scopes: ['files:read', 'files:write', 'billing:read'] });
      await h
        .http()
        .post('/api-keys')
        .set(...withKey(key))
        .send({ name: 'persistence', scopes: ['files:read'] })
        .expect(403);
      await h.http().get('/api-keys').set(...withKey(key)).expect(403);
      expect(await keys().count()).toBe(1);
    });

    it(`caps a person at ${MAX_ACTIVE_KEYS_PER_USER} active keys; revoking frees a slot`, async () => {
      await keys().insert(
        Array.from({ length: MAX_ACTIVE_KEYS_PER_USER }, (_, index) => ({
          companyId: admin.companyId,
          createdByUserId: admin.userId,
          name: `seeded ${index}`,
          prefix: 'gl_live_00000000',
          keyHash: randomUUID(),
          scopes: ['files:read' as const],
        })),
      );

      const create = () =>
        h.http().post('/api-keys').set(...h.bearer(adminSession)).send({ name: 'one more', scopes: ['files:read'] });
      const refused = await create().expect(409);
      expect(refused.body.message).toMatch(/25/);

      // The cap is per person: the employee is unaffected.
      await h.createApiKey(employee.session);

      const first = await keys().findOneByOrFail({ name: 'seeded 0' });
      await h.http().delete(`/api-keys/${first.id}`).set(...h.bearer(adminSession)).expect(200);
      await create().expect(201);
    });

    it('takes the creator’s row lock, so two simultaneous creations cannot both take the last slot', async () => {
      await keys().insert(
        Array.from({ length: MAX_ACTIVE_KEYS_PER_USER - 1 }, (_, index) => ({
          companyId: admin.companyId,
          createdByUserId: admin.userId,
          name: `seeded ${index}`,
          prefix: 'gl_live_00000000',
          keyHash: randomUUID(),
          scopes: ['files:read' as const],
        })),
      );

      const holder = h.dataSource.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      // NO KEY UPDATE, not UPDATE: the latter would also block the foreign-key check on the
      // insert, and the test would pass without the service taking any lock of its own.
      await holder.query('SELECT id FROM "user" WHERE id = $1 FOR NO KEY UPDATE', [admin.userId]);

      let answered = false;
      const pending = h
        .http()
        .post('/api-keys')
        .set(...h.bearer(adminSession))
        .send({ name: 'waits', scopes: ['files:read'] })
        .then((response) => {
          answered = true;
          return response;
        });

      try {
        await new Promise((resolve) => setTimeout(resolve, 600));
        expect(answered).toBe(false);
      } finally {
        await holder.commitTransaction();
        await holder.release();
      }
      expect((await pending).status).toBe(201);
    });

    it('audits the creation without the secret', async () => {
      const { id, key } = await h.createApiKey(adminSession, { name: 'Audited', scopes: ['files:read'] });

      const [entry] = await auditRows('api_key.created');
      expect(entry).toMatchObject({ actorUserId: admin.userId, targetType: 'api_key', targetId: id });
      expect(entry?.metadata).toMatchObject({ name: 'Audited', scopes: ['files:read'] });
      expect(JSON.stringify(entry)).not.toContain(key);
      expect(JSON.stringify(entry)).not.toContain(sha256(key));
    });
  });

  describe('listing and revoking: who sees whose', () => {
    it('an admin sees every key in the company, an employee only their own; newest first', async () => {
      const adminKey = await h.createApiKey(adminSession, { name: 'admin key' });
      h.clock.advance(1_000);
      const employeeKey = await h.createApiKey(employee.session, { name: 'employee key' });

      const asAdmin = await h.http().get('/api-keys').set(...h.bearer(adminSession)).expect(200);
      expect(asAdmin.body.data.map((row: { id: string }) => row.id)).toEqual([employeeKey.id, adminKey.id]);
      expect(asAdmin.body.meta).toMatchObject({ page: 1, limit: 20, total: 2 });

      const asEmployee = await h.http().get('/api-keys').set(...h.bearer(employee.session)).expect(200);
      expect(asEmployee.body.data.map((row: { id: string }) => row.id)).toEqual([employeeKey.id]);
      expect(asEmployee.body.meta.total).toBe(1);
    });

    it('paginates', async () => {
      for (let index = 0; index < 3; index += 1) {
        h.clock.advance(1_000);
        await h.createApiKey(adminSession, { name: `k${index}` });
      }
      const page = await h.http().get('/api-keys').query({ page: 2, limit: 2 }).set(...h.bearer(adminSession)).expect(200);
      expect(page.body.data).toHaveLength(1);
      expect(page.body.meta).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
    });

    it('an employee cannot revoke a colleague’s or the admin’s key (404, not 403); an admin can revoke anyone’s', async () => {
      const adminKey = await h.createApiKey(adminSession);
      const employeeKey = await h.createApiKey(employee.session);

      await h.http().delete(`/api-keys/${adminKey.id}`).set(...h.bearer(employee.session)).expect(404);
      expect((await keys().findOneByOrFail({ id: adminKey.id })).revokedAt).toBeNull();

      await h.http().delete(`/api-keys/${employeeKey.id}`).set(...h.bearer(adminSession)).expect(200);
      expect((await keys().findOneByOrFail({ id: employeeKey.id })).revokedAt).not.toBeNull();
    });

    it('an employee can revoke their own', async () => {
      const own = await h.createApiKey(employee.session);
      const response = await h.http().delete(`/api-keys/${own.id}`).set(...h.bearer(employee.session)).expect(200);
      expect(response.body.revokedAt).toBe(h.clock.now().toISOString());
    });

    it('another company’s keys do not exist here', async () => {
      const other = await h.registerAndActivate();
      const otherSession = await h.login(other.email);
      const theirs = await h.createApiKey(otherSession);

      await h.http().delete(`/api-keys/${theirs.id}`).set(...h.bearer(adminSession)).expect(404);
      const listed = await h.http().get('/api-keys').set(...h.bearer(adminSession)).expect(200);
      expect(listed.body.data).toEqual([]);
      expect((await keys().findOneByOrFail({ id: theirs.id })).revokedAt).toBeNull();
    });

    it('revoking twice is harmless and audits once', async () => {
      const { id } = await h.createApiKey(adminSession);
      const first = await h.http().delete(`/api-keys/${id}`).set(...h.bearer(adminSession)).expect(200);
      h.clock.advance(60_000);
      const second = await h.http().delete(`/api-keys/${id}`).set(...h.bearer(adminSession)).expect(200);

      expect(second.body.revokedAt).toBe(first.body.revokedAt);
      expect(await auditRows('api_key.revoked')).toHaveLength(1);
    });

    it('a malformed id is a 400', async () => {
      await h.http().delete('/api-keys/not-a-uuid').set(...h.bearer(adminSession)).expect(400);
    });
  });

  describe('authenticating with a key', () => {
    it('an employee’s key uploads AS that employee, and the audit trail names the key', async () => {
      const { key, id } = await h.createApiKey(employee.session, { scopes: ['files:write'] });

      const uploaded = await h.upload(employee.session, { bearer: key }).expect(201);
      expect(uploaded.body.uploaderId).toBe(employee.userId);

      const [entry] = await auditRows('file.uploaded');
      expect(entry).toMatchObject({ actorUserId: employee.userId });
      expect(entry?.metadata).toMatchObject({ apiKeyId: id });

      // The same action by session carries no key.
      await h.upload(employee.session).expect(201);
      const entries = await auditRows('file.uploaded');
      expect(entries[1]?.metadata).not.toHaveProperty('apiKeyId');
    });

    it('enforces scopes per route: read vs write, and billing', async () => {
      const readOnly = (await h.createApiKey(adminSession, { scopes: ['files:read'] })).key;
      const writeOnly = (await h.createApiKey(adminSession, { scopes: ['files:write'] })).key;
      const billing = (await h.createApiKey(adminSession, { scopes: ['billing:read'] })).key;

      const uploaded = await h.upload(adminSession).expect(201);
      const fileId = uploaded.body.id;

      // files:read reads but cannot change anything.
      await h.http().get('/files').set(...withKey(readOnly)).expect(200);
      await h.http().get(`/files/${fileId}`).set(...withKey(readOnly)).expect(200);
      await h.http().get('/subscriptions/me').set(...withKey(readOnly)).expect(200);
      await h.upload(adminSession, { bearer: readOnly }).expect(403);
      await h.http().patch(`/files/${fileId}`).set(...withKey(readOnly)).send({ visibility: 'company' }).expect(403);
      await h.http().delete(`/files/${fileId}`).set(...withKey(readOnly)).expect(403);

      // files:write changes things but does not read.
      await h.upload(adminSession, { bearer: writeOnly }).expect(201);
      await h.http().get('/files').set(...withKey(writeOnly)).expect(403);
      await h.http().patch(`/files/${fileId}`).set(...withKey(writeOnly)).send({ visibility: 'company' }).expect(200);
      await h.http().delete(`/files/${fileId}`).set(...withKey(writeOnly)).expect(200);

      // billing:read reads billing and nothing else.
      await h.http().get('/billing/current').set(...withKey(billing)).expect(200);
      await h.http().get('/billing/invoices').set(...withKey(billing)).expect(200);
      await h.http().get('/files').set(...withKey(billing)).expect(403);
      await h.http().get('/billing/current').set(...withKey(readOnly)).expect(403);
    });

    it('is closed by default on every route that never mentioned keys', async () => {
      const { key } = await h.createApiKey(adminSession, { scopes: ['files:read', 'files:write', 'billing:read'] });
      const attempts: Array<[string, string]> = [
        ['get', '/auth/me'],
        ['get', '/auth/identities'],
        ['get', '/employees'],
        ['post', '/employees'],
        ['get', '/api-keys'],
        ['get', '/audit'],
        ['get', '/analytics/usage'],
        ['patch', '/companies/me'],
        ['patch', '/users/me'],
        ['patch', '/subscriptions/me'],
        ['post', '/subscriptions/me'],
        ['get', '/companies/me/members'],
        ['patch', '/auth/password'],
      ];
      for (const [method, path] of attempts) {
        const request = method === 'get' ? h.http().get(path) : method === 'post' ? h.http().post(path) : h.http().patch(path);
        const response = await request.set(...withKey(key)).send({});
        expect(response.status, `${method.toUpperCase()} ${path}`).toBe(403);
      }
    });

    it('the billing scope is admin-only even on an admin key: billing routes stay @Roles(admin)', async () => {
      // A key row that claims billing:read for an employee (as if minted before a demotion).
      const row = await keys().save(
        keys().create({
          companyId: admin.companyId,
          createdByUserId: employee.userId,
          name: 'stale',
          prefix: 'gl_live_deadbeef',
          keyHash: sha256(`gl_live_deadbeef_${'B'.repeat(43)}`),
          scopes: ['files:read', 'billing:read'],
          lastUsedAt: null,
          revokedAt: null,
        }),
      );
      const token = `gl_live_deadbeef_${'B'.repeat(43)}`;
      expect(row.id).toBeDefined();

      await h.http().get('/files').set(...withKey(token)).expect(200);
      await h.http().get('/billing/current').set(...withKey(token)).expect(403);

      // No route can show it (RolesGuard would refuse either way), so ask the authenticator:
      // the scope the creator's role no longer allows is not among the key's effective scopes.
      const { user } = await h.app.get(ApiKeyAuthenticationService).authenticate(token);
      expect(user.scopes).toEqual(['files:read']);
    });

    it('rejects revoked, unknown and malformed keys with one and the same 401', async () => {
      const { key, id } = await h.createApiKey(adminSession);
      await h.http().get('/files').set(...withKey(key)).expect(200);
      await h.http().delete(`/api-keys/${id}`).set(...h.bearer(adminSession)).expect(200);

      const unknownButWellFormed = `gl_live_00000000_${'A'.repeat(43)}`;
      const responses = await Promise.all([
        h.http().get('/files').set(...withKey(key)),
        h.http().get('/files').set(...withKey(unknownButWellFormed)),
        h.http().get('/files').set(...withKey('gl_live_short')),
        h.http().get('/files').set(...withKey(`${key}x`)),
      ]);
      for (const response of responses) expect(response.status).toBe(401);
      expect(new Set(responses.map((response) => response.body.message)).size).toBe(1);
    });

    it('stops working the moment the creator is disabled, without waiting for anything to be revoked', async () => {
      const { key } = await h.createApiKey(employee.session);
      await h.http().get('/files').set(...withKey(key)).expect(200);

      // Straight to the row: no revocation runs, so only the live re-read can stop it.
      await h.dataSource.getRepository(User).update({ id: employee.userId }, { status: 'disabled' });

      await h.http().get('/files').set(...withKey(key)).expect(401);
      expect((await keys().findOneByOrFail({ createdByUserId: employee.userId })).revokedAt).toBeNull();
    });

    it('acts as the creator’s CURRENT role: a demoted admin’s key loses admin sight of restricted files', async () => {
      const other = await h.inviteAndAccept(adminSession, admin.companyId);
      const restricted = await h.upload(other.session, { visibility: 'restricted' }).expect(201);
      const { key } = await h.createApiKey(adminSession, { scopes: ['files:read'] });

      await h.http().get(`/files/${restricted.body.id}`).set(...withKey(key)).expect(200);

      await h.dataSource.getRepository(User).update({ id: admin.userId }, { role: 'employee' });

      await h.http().get(`/files/${restricted.body.id}`).set(...withKey(key)).expect(404);
    });

    it('a suspended company’s key reaches only what a suspended session can', async () => {
      const readKey = (await h.createApiKey(adminSession, { scopes: ['files:read'] })).key;
      const billingKey = (await h.createApiKey(adminSession, { scopes: ['billing:read'] })).key;
      await h.dataSource.getRepository(Company).update({ id: admin.companyId }, { status: 'suspended' });

      await h.http().get('/files').set(...withKey(readKey)).expect(403);
      await h.http().get('/billing/current').set(...withKey(billingKey)).expect(200);
    });

    it('records lastUsedAt, but at most once per five minutes', async () => {
      const { key, id } = await h.createApiKey(adminSession);
      expect((await keys().findOneByOrFail({ id })).lastUsedAt).toBeNull();

      await h.http().get('/files').set(...withKey(key)).expect(200);
      const firstUse = h.clock.now();
      expect((await keys().findOneByOrFail({ id })).lastUsedAt?.toISOString()).toBe(firstUse.toISOString());

      h.clock.advance(LAST_USED_GRANULARITY_MS - 1_000);
      await h.http().get('/files').set(...withKey(key)).expect(200);
      expect((await keys().findOneByOrFail({ id })).lastUsedAt?.toISOString()).toBe(firstUse.toISOString());

      h.clock.advance(2_000);
      await h.http().get('/files').set(...withKey(key)).expect(200);
      expect((await keys().findOneByOrFail({ id })).lastUsedAt?.toISOString()).toBe(h.clock.now().toISOString());

      const listed = await h.http().get('/api-keys').set(...h.bearer(adminSession)).expect(200);
      expect(listed.body.data[0].lastUsedAt).toBe(h.clock.now().toISOString());
    });

  });

  describe('removing an employee', () => {
    it('revokes their keys with them, counts them in the audit entry, and leaves other people’s keys alone', async () => {
      const first = await h.createApiKey(employee.session, { name: 'a' });
      await h.createApiKey(employee.session, { name: 'b' });
      const alreadyRevoked = await h.createApiKey(employee.session, { name: 'c' });
      await h.http().delete(`/api-keys/${alreadyRevoked.id}`).set(...h.bearer(adminSession)).expect(200);
      const adminKey = await h.createApiKey(adminSession, { name: 'admin' });

      h.clock.advance(60_000);
      await h.http().delete(`/employees/${employee.userId}`).set(...h.bearer(adminSession)).expect(200);

      const rows = await keys().find({ where: { createdByUserId: employee.userId } });
      expect(rows).toHaveLength(3);
      expect(rows.every((row) => row.revokedAt !== null)).toBe(true);
      // The one revoked earlier keeps its earlier time.
      expect(rows.find((row) => row.id === alreadyRevoked.id)?.revokedAt?.toISOString()).not.toBe(
        h.clock.now().toISOString(),
      );
      expect((await keys().findOneByOrFail({ id: adminKey.id })).revokedAt).toBeNull();

      const [entry] = await auditRows('employee.disabled');
      expect(entry?.metadata).toMatchObject({ revokedApiKeys: 2 });

      await h.http().get('/files').set(...withKey(first.key)).expect(401);
    });

    it('does not bring the keys back when the person is reactivated', async () => {
      const { key } = await h.createApiKey(employee.session);
      await h.http().delete(`/employees/${employee.userId}`).set(...h.bearer(adminSession)).expect(200);
      await h.http().post(`/employees/${employee.userId}/reactivate`).set(...h.bearer(adminSession)).expect(200);
      await h.dataSource.getRepository(User).update({ id: employee.userId }, { status: 'active' });

      await h.http().get('/files').set(...withKey(key)).expect(401);
    });
  });
});
