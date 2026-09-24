import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, DEFAULT_PASSWORD } from '../../test/support/app-harness.js';
import { AuditLogEntry } from '../core/audit/audit-log-entry.entity.js';
import { BackgroundTask } from '../core/tasks/background-task.entity.js';
import { AuthIdentity } from '../database/entities/auth-identity.entity.js';
import { Company } from '../database/entities/company.entity.js';
import { User } from '../database/entities/user.entity.js';

const VALID = {
  companyName: 'Acme Logistics',
  email: 'boss@acme.test',
  password: DEFAULT_PASSWORD,
  country: 'GE',
  industry: 'logistics',
};

describe('company registration and activation (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  function register(body: Record<string, unknown> = VALID) {
    return h.http().post('/auth/register-company').send(body);
  }

  describe('the five-field DTO', () => {
    it.each(['companyName', 'email', 'password', 'country', 'industry'])(
      'rejects a registration missing %s',
      async (field) => {
        const body: Record<string, unknown> = { ...VALID };
        delete body[field];

        const response = await register(body).expect(400);

        expect(response.body).toMatchObject({ statusCode: 400 });
        expect(await h.dataSource.getRepository(Company).count()).toBe(0);
      },
    );

    it.each([
      ['a malformed email', { email: 'not-an-email' }],
      ['a password under 8 characters', { password: 'short' }],
      ['an absurdly long password', { password: 'x'.repeat(500) }],
      ['a country that is not a two-letter code', { country: 'Georgia' }],
      ['an unknown industry', { industry: 'piracy' }],
    ])('rejects %s', async (_name, override) => {
      await register({ ...VALID, ...override }).expect(400);
    });

    it('rejects a field it does not know, rather than silently ignoring it', async () => {
      // `role: 'admin'` sneaking through would be a privilege-escalation habit.
      await register({ ...VALID, role: 'admin' }).expect(400);
      await register({ ...VALID, status: 'active' }).expect(400);
    });

    it('normalises email case and country case', async () => {
      await register({ ...VALID, email: '  Boss@ACME.test ', country: 'ge' }).expect(201);

      const company = await h.dataSource.getRepository(Company).findOneByOrFail({
        billingEmail: 'boss@acme.test',
      });
      expect(company.country).toBe('GE');
    });
  });

  describe('what registering creates', () => {
    it('creates a pending company, an invited admin and a password identity — all in one go', async () => {
      const response = await register().expect(201);

      expect(response.body).toMatchObject({ status: 'pending_activation' });
      const company = await h.dataSource.getRepository(Company).findOneByOrFail({
        billingEmail: 'boss@acme.test',
      });
      expect(company).toMatchObject({
        name: 'Acme Logistics',
        status: 'pending_activation',
        activatedAt: null,
        country: 'GE',
        industry: 'logistics',
      });

      const user = await h.dataSource.getRepository(User).findOneByOrFail({ companyId: company.id });
      expect(user).toMatchObject({ role: 'admin', status: 'invited', email: 'boss@acme.test' });

      const identity = await h.dataSource
        .getRepository(AuthIdentity)
        .findOneByOrFail({ userId: user.id });
      expect(identity.provider).toBe('password');
      // The provider subject is the user's own id, not the email.
      expect(identity.providerUserId).toBe(user.id);
      // A hash, never the password.
      expect(identity.passwordHash).toMatch(/^scrypt\$/);
      expect(identity.passwordHash).not.toContain(DEFAULT_PASSWORD);
    });

    it('never returns credentials or hashes', async () => {
      const response = await register().expect(201);

      expect(Object.keys(response.body).sort()).toEqual(['companyId', 'message', 'status', 'userId']);
    });

    it('queues the activation email, and sends it only once the task runs', async () => {
      await register().expect(201);
      expect(h.mail.sent).toHaveLength(0);

      await h.drainTasks();

      const email = h.mail.latestTo('boss@acme.test');
      expect(email?.subject).toBe('Activate your Gridline account');
      expect(h.mail.latestLinkTo('boss@acme.test').pathname).toBe('/activate');
    });

    it('records who registered in the audit trail', async () => {
      await register().expect(201);

      const entries = await h.dataSource.getRepository(AuditLogEntry).find();
      expect(entries.map((entry) => entry.action)).toEqual(['company.registered']);
    });
  });

  describe('duplicates', () => {
    it('rejects a second registration with the same email (409), without a second email', async () => {
      await register().expect(201);
      await h.drainTasks();
      h.mail.clear();

      await register({ ...VALID, companyName: 'Other Co' }).expect(409);

      await h.drainTasks();
      expect(h.mail.sent).toHaveLength(0);
      expect(await h.dataSource.getRepository(Company).count()).toBe(1);
    });

    it('treats the email case-insensitively', async () => {
      await register().expect(201);
      await register({ ...VALID, email: 'BOSS@Acme.Test' }).expect(409);
    });

    it('rolls back everything, including the queued email, when registration fails', async () => {
      await register().expect(201);
      await h.drainTasks();
      const tasksBefore = await h.dataSource.getRepository(BackgroundTask).count();
      const usersBefore = await h.dataSource.getRepository(User).count();

      await register().expect(409);

      expect(await h.dataSource.getRepository(BackgroundTask).count()).toBe(tasksBefore);
      expect(await h.dataSource.getRepository(User).count()).toBe(usersBefore);
    });
  });

  describe('before activation', () => {
    it('refuses login while the company is pending activation', async () => {
      await register().expect(201);

      const response = await h
        .http()
        .post('/auth/login')
        .send({ email: VALID.email, password: VALID.password })
        .expect(403);

      expect(response.body.message).toMatch(/not activated/i);
    });

    it('refuses to use a session-only route with no token', async () => {
      await h.http().get('/auth/me').expect(401);
    });
  });

  describe('activation', () => {
    it('register → (cannot log in) → activate → log in', async () => {
      await register().expect(201);
      await h.drainTasks();

      await h.http().post('/auth/login').send({ email: VALID.email, password: VALID.password }).expect(403);

      await h.http().get('/auth/activate').query({ token: h.mail.latestTokenTo(VALID.email) }).expect(200);

      const session = await h.login(VALID.email);
      const me = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(me.body.user).toMatchObject({ role: 'admin', status: 'active' });
      expect(me.body.company).toMatchObject({ status: 'active', name: 'Acme Logistics' });
    });

    it('stamps activatedAt from the clock on both the company and the admin', async () => {
      await register().expect(201);
      await h.drainTasks();
      h.clock.advance(60 * 60_000);

      await h.http().get('/auth/activate').query({ token: h.mail.latestTokenTo(VALID.email) }).expect(200);

      const company = await h.dataSource.getRepository(Company).findOneByOrFail({
        billingEmail: VALID.email,
      });
      expect(company.activatedAt?.toISOString()).toBe(h.clock.now().toISOString());
    });

    it('records the activation in the audit trail, after the registration', async () => {
      await register().expect(201);
      await h.drainTasks();
      await h.http().get('/auth/activate').query({ token: h.mail.latestTokenTo(VALID.email) }).expect(200);

      const entries = await h.dataSource.getRepository(AuditLogEntry).find({ order: { createdAt: 'ASC' } });
      expect(entries.map((entry) => entry.action)).toEqual(['company.registered', 'company.activated']);
    });

    it('spends the token: a second use is rejected', async () => {
      await register().expect(201);
      await h.drainTasks();
      const token = h.mail.latestTokenTo(VALID.email);

      await h.http().get('/auth/activate').query({ token }).expect(200);
      await h.http().get('/auth/activate').query({ token }).expect(400);
    });

    it('lets exactly one of two simultaneous activations win', async () => {
      await register().expect(201);
      await h.drainTasks();
      const token = h.mail.latestTokenTo(VALID.email);

      const statuses = (
        await Promise.all([
          h.http().get('/auth/activate').query({ token }),
          h.http().get('/auth/activate').query({ token }),
        ])
      )
        .map((response) => response.status)
        .sort();

      expect(statuses).toEqual([200, 400]);
    });

    it.each([
      ['an unknown token', 'this-token-was-never-issued'],
      ['a token that is not even the right shape', '!!!'],
    ])('rejects %s', async (_name, token) => {
      await h.http().get('/auth/activate').query({ token }).expect(400);
    });

    it('rejects a request with no token at all', async () => {
      await h.http().get('/auth/activate').expect(400);
    });

    it('rejects an expired token, and resending gives a working one', async () => {
      await register().expect(201);
      await h.drainTasks();
      const expired = h.mail.latestTokenTo(VALID.email);

      h.clock.advance(24 * 60 * 60_000 + 1_000);
      await h.http().get('/auth/activate').query({ token: expired }).expect(400);

      await h.http().post('/auth/resend-activation').send({ email: VALID.email }).expect(200);
      await h.drainTasks();
      const fresh = h.mail.latestTokenTo(VALID.email);
      expect(fresh).not.toBe(expired);

      await h.http().get('/auth/activate').query({ token: fresh }).expect(200);
      await h.login(VALID.email);
    });

    it('a resend kills the previous link', async () => {
      await register().expect(201);
      await h.drainTasks();
      const first = h.mail.latestTokenTo(VALID.email);

      await h.http().post('/auth/resend-activation').send({ email: VALID.email }).expect(200);
      await h.drainTasks();

      await h.http().get('/auth/activate').query({ token: first }).expect(400);
      await h.http().get('/auth/activate').query({ token: h.mail.latestTokenTo(VALID.email) }).expect(200);
    });
  });

  describe('resending activation never reveals whether an account exists', () => {
    it('gives the same answer for a real pending account and an unknown address', async () => {
      await register().expect(201);
      await h.drainTasks();
      h.mail.clear();

      const real = await h.http().post('/auth/resend-activation').send({ email: VALID.email }).expect(200);
      const unknown = await h
        .http()
        .post('/auth/resend-activation')
        .send({ email: 'nobody@nowhere.test' })
        .expect(200);

      expect(real.body).toEqual(unknown.body);
      await h.drainTasks();
      // …but only the real one got an email.
      expect(h.mail.to(VALID.email)).toHaveLength(1);
      expect(h.mail.to('nobody@nowhere.test')).toHaveLength(0);
    });

    it('sends nothing for an account that is already active', async () => {
      const account = await h.registerAndActivate();
      h.mail.clear();

      await h.http().post('/auth/resend-activation').send({ email: account.email }).expect(200);

      await h.drainTasks();
      expect(h.mail.sent).toHaveLength(0);
    });
  });
});
