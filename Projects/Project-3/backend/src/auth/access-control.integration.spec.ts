import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, type RegisteredAccount } from '../../test/support/app-harness.js';
import { Company } from '../database/entities/company.entity.js';
import { User } from '../database/entities/user.entity.js';

function base64url(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('the global auth guard (integration)', () => {
  let h: AppHarness;
  let admin: RegisteredAccount;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    admin = await h.registerAndActivate();
  });

  afterAll(() => h.stop());

  describe('opt-out: a route needs a token unless it is @Public()', () => {
    it.each([
      ['GET', '/auth/me'],
      ['PATCH', '/auth/password'],
      ['PATCH', '/users/me'],
      ['PATCH', '/companies/me'],
    ])('%s %s requires authentication', async (method, path) => {
      const response = await h.http()[method === 'GET' ? 'get' : 'patch'](path);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ statusCode: 401 });
    });

    it('leaves /health public', async () => {
      await h.http().get('/health').expect(200);
    });

    it('leaves the auth entry points public', async () => {
      // Each must reach validation (400), not be turned away at the door (401).
      for (const path of ['/auth/login', '/auth/refresh', '/auth/logout', '/auth/password/forgot']) {
        expect((await h.http().post(path).send({})).status).toBe(400);
      }
    });
  });

  describe('bad credentials', () => {
    it.each([
      ['no scheme', 'sometoken'],
      ['the wrong scheme', 'Basic dXNlcjpwYXNz'],
      ['an empty bearer', 'Bearer '],
      ['garbage', 'Bearer not.a.jwt'],
    ])('rejects %s', async (_name, header) => {
      await h.http().get('/auth/me').set('Authorization', header).expect(401);
    });

    it('rejects a token whose payload was edited but whose signature was kept', async () => {
      const session = await h.login(admin.email);
      const other = await h.seedEmployee(admin.companyId);
      const [header, , signature] = session.accessToken.split('.');
      const forgedPayload = base64url({ sub: other.userId, iat: 0, exp: 9_999_999_999 });

      await h
        .http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${header}.${forgedPayload}.${signature}`)
        .expect(401);
    });

    it('rejects an unsigned token (alg: none)', async () => {
      const now = Math.floor(h.clock.now().getTime() / 1000);
      const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
        sub: admin.userId,
        iat: now,
        exp: now + 900,
      })}.`;

      await h.http().get('/auth/me').set('Authorization', `Bearer ${unsigned}`).expect(401);
    });

    it('rejects a token signed with a different secret', async () => {
      const now = Math.floor(h.clock.now().getTime() / 1000);
      const head = base64url({ alg: 'HS256', typ: 'JWT' });
      const body = base64url({ sub: admin.userId, iat: now, exp: now + 900 });
      const signature = createHmac('sha256', 'a-completely-different-secret')
        .update(`${head}.${body}`)
        .digest('base64url');

      await h.http().get('/auth/me').set('Authorization', `Bearer ${head}.${body}.${signature}`).expect(401);
    });

    it('rejects a token for a user id that no longer exists', async () => {
      const session = await h.login(admin.email);
      await h.dataSource.getRepository(Company).delete({ id: admin.companyId });

      await h.http().get('/auth/me').set(...h.bearer(session)).expect(401);
    });
  });

  describe('identity is re-read from the database on every request', () => {
    it('locks out a disabled user immediately, though their token has not expired', async () => {
      const session = await h.login(admin.email);
      await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);

      await h.dataSource.getRepository(User).update({ id: admin.userId }, { status: 'disabled' });

      await h.http().get('/auth/me').set(...h.bearer(session)).expect(401);
    });

    it('applies a demotion on the very next request', async () => {
      const session = await h.login(admin.email);
      await h.http().patch('/companies/me').set(...h.bearer(session)).send({ name: 'Before' }).expect(200);

      await h.dataSource.getRepository(User).update({ id: admin.userId }, { role: 'employee' });

      await h.http().patch('/companies/me').set(...h.bearer(session)).send({ name: 'After' }).expect(403);
    });

    it('applies a promotion just as fast', async () => {
      const employee = await h.seedEmployee(admin.companyId);
      const session = await h.login(employee.email);
      await h.http().patch('/companies/me').set(...h.bearer(session)).send({ name: 'X Co' }).expect(403);

      await h.dataSource.getRepository(User).update({ id: employee.userId }, { role: 'admin' });

      await h.http().patch('/companies/me').set(...h.bearer(session)).send({ name: 'X Co' }).expect(200);
    });

    it('turns a suspended company away with 403', async () => {
      const session = await h.login(admin.email);

      await h.dataSource.getRepository(Company).update({ id: admin.companyId }, { status: 'suspended' });

      await h.http().get('/auth/me').set(...h.bearer(session)).expect(403);
    });

    it('does not let an invited (not yet accepted) user in even with a genuine token', async () => {
      const session = await h.login(admin.email);
      await h.dataSource.getRepository(User).update({ id: admin.userId }, { status: 'invited' });

      await h.http().get('/auth/me').set(...h.bearer(session)).expect(401);
    });
  });

  describe('error envelope', () => {
    it('renders a 401 in the standard shape with a correlation id', async () => {
      const response = await h.http().get('/auth/me').set('x-correlation-id', 'trace-42').expect(401);

      expect(response.body).toMatchObject({ statusCode: 401, correlationId: 'trace-42' });
      expect(typeof response.body.timestamp).toBe('string');
    });
  });
});
