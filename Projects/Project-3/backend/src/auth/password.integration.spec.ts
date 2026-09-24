import { IsNull } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, DEFAULT_PASSWORD, type RegisteredAccount } from '#test/support/app-harness.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { RefreshToken } from '#/database/entities/refresh-token.entity.js';
import { PASSWORD_RESET_TOKEN_TTL_MS } from './auth.constants.js';

const NEW_PASSWORD = 'a-brand-new-passphrase';

describe('password reset and change (integration)', () => {
  let h: AppHarness;
  let account: RegisteredAccount;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    account = await h.registerAndActivate();
    h.mail.clear();
  });

  afterAll(() => h.stop());

  async function requestReset(email: string = account.email): Promise<string> {
    await h.http().post('/auth/password/forgot').send({ email }).expect(200);
    await h.drainTasks();
    return h.mail.latestTokenTo(email);
  }

  function canLogIn(password: string, email: string = account.email) {
    return h.http().post('/auth/login').send({ email, password });
  }

  describe('forgot password', () => {
    it('emails a reset link to an active account', async () => {
      await requestReset();

      const email = h.mail.latestTo(account.email);
      expect(email?.subject).toBe('Reset your Gridline password');
      expect(h.mail.latestLinkTo(account.email).pathname).toBe('/reset-password');
    });

    it('answers identically for a real and an unknown address, and emails only the real one', async () => {
      const real = await h.http().post('/auth/password/forgot').send({ email: account.email }).expect(200);
      const unknown = await h
        .http()
        .post('/auth/password/forgot')
        .send({ email: 'ghost@nowhere.test' })
        .expect(200);
      await h.drainTasks();

      expect(real.body).toEqual(unknown.body);
      expect(h.mail.to(account.email)).toHaveLength(1);
      expect(h.mail.to('ghost@nowhere.test')).toHaveLength(0);
    });

    it('emails nobody for an account that has not been activated', async () => {
      await h
        .http()
        .post('/auth/register-company')
        .send({
          companyName: 'Pending Co',
          email: 'pending@acme.test',
          password: DEFAULT_PASSWORD,
          country: 'GE',
          industry: 'other',
        })
        .expect(201);
      await h.drainTasks();
      h.mail.clear();

      await h.http().post('/auth/password/forgot').send({ email: 'pending@acme.test' }).expect(200);
      await h.drainTasks();

      expect(h.mail.sent).toHaveLength(0);
    });

    it('a second request kills the first link', async () => {
      const first = await requestReset();
      const second = await requestReset();

      await h.http().post('/auth/password/reset').send({ token: first, newPassword: NEW_PASSWORD }).expect(400);
      await h.http().post('/auth/password/reset').send({ token: second, newPassword: NEW_PASSWORD }).expect(200);
    });
  });

  describe('reset password', () => {
    it('sets the new password, and the old one stops working', async () => {
      const token = await requestReset();

      await h.http().post('/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(200);

      await canLogIn(NEW_PASSWORD).expect(200);
      await canLogIn(DEFAULT_PASSWORD).expect(401);
    });

    it('signs the account out of every device', async () => {
      const laptop = await h.login(account.email);
      const phone = await h.login(account.email);
      const token = await requestReset();

      await h.http().post('/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(200);

      await h.http().post('/auth/refresh').send({ refreshToken: laptop.refreshToken }).expect(401);
      await h.http().post('/auth/refresh').send({ refreshToken: phone.refreshToken }).expect(401);
      const live = await h.dataSource.getRepository(RefreshToken).count({ where: { revokedAt: IsNull() } });
      expect(live).toBe(0);
    });

    it('is single-use', async () => {
      const token = await requestReset();

      await h.http().post('/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(200);
      await h.http().post('/auth/password/reset').send({ token, newPassword: 'yet-another-one-1' }).expect(400);
      await canLogIn(NEW_PASSWORD).expect(200);
    });

    it('expires after an hour', async () => {
      const token = await requestReset();

      h.clock.advance(PASSWORD_RESET_TOKEN_TTL_MS + 1_000);

      await h.http().post('/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(400);
      await canLogIn(DEFAULT_PASSWORD).expect(200);
    });

    it('will not accept another kind of token — an activation link cannot reset a password', async () => {
      // Register a fresh company and try its ACTIVATION token as a reset token.
      await h
        .http()
        .post('/auth/register-company')
        .send({
          companyName: 'Other Co',
          email: 'other@acme.test',
          password: DEFAULT_PASSWORD,
          country: 'GE',
          industry: 'other',
        })
        .expect(201);
      await h.drainTasks();
      const activationToken = h.mail.latestTokenTo('other@acme.test');

      await h
        .http()
        .post('/auth/password/reset')
        .send({ token: activationToken, newPassword: NEW_PASSWORD })
        .expect(400);

      // …and it was not consumed by the failed attempt: it still activates.
      await h.http().get('/auth/activate').query({ token: activationToken }).expect(200);
    });

    it('enforces the password policy on the new password', async () => {
      const token = await requestReset();

      await h.http().post('/auth/password/reset').send({ token, newPassword: 'short' }).expect(400);
      // A rejected body must not have spent the token.
      await h.http().post('/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(200);
    });

    it('confirms by email that the password changed', async () => {
      const token = await requestReset();
      h.mail.clear();

      await h.http().post('/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(200);
      await h.drainTasks();

      expect(h.mail.latestTo(account.email)?.subject).toBe('Your Gridline password was changed');
    });

    it('records the request and the reset in the audit trail', async () => {
      const token = await requestReset();
      await h.http().post('/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(200);

      const actions = (await h.dataSource.getRepository(AuditLogEntry).find({ order: { createdAt: 'ASC' } }))
        .map((entry) => entry.action);
      expect(actions).toEqual(
        expect.arrayContaining(['auth.password_reset_requested', 'auth.password_reset']),
      );
    });
  });

  describe('change password (signed in)', () => {
    it('requires the current password', async () => {
      const session = await h.login(account.email);

      const response = await h
        .http()
        .patch('/auth/password')
        .set(...h.bearer(session))
        .send({ currentPassword: 'wrong-current', newPassword: NEW_PASSWORD })
        .expect(400);

      expect(response.body.message).toMatch(/current password/i);
      await canLogIn(DEFAULT_PASSWORD).expect(200);
    });

    it('rejects reusing the same password', async () => {
      const session = await h.login(account.email);

      await h
        .http()
        .patch('/auth/password')
        .set(...h.bearer(session))
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD })
        .expect(400);
    });

    it('invalidates every old refresh family, and hands this device a fresh session', async () => {
      const thisDevice = await h.login(account.email);
      const otherDevice = await h.login(account.email);

      const response = await h
        .http()
        .patch('/auth/password')
        .set(...h.bearer(thisDevice))
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);
      const fresh = h.parseSession(response.body);

      // Old refresh tokens — on this device and the other — are dead.
      await h.http().post('/auth/refresh').send({ refreshToken: thisDevice.refreshToken }).expect(401);
      await h.http().post('/auth/refresh').send({ refreshToken: otherDevice.refreshToken }).expect(401);
      // The fresh session works, and can itself be refreshed.
      await h.http().get('/auth/me').set(...h.bearer(fresh)).expect(200);
      await h.http().post('/auth/refresh').send({ refreshToken: fresh.refreshToken }).expect(200);
    });

    it('swaps which password logs in', async () => {
      const session = await h.login(account.email);

      await h
        .http()
        .patch('/auth/password')
        .set(...h.bearer(session))
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);

      await canLogIn(NEW_PASSWORD).expect(200);
      await canLogIn(DEFAULT_PASSWORD).expect(401);
    });

    it('emails a confirmation and audits the change', async () => {
      const session = await h.login(account.email);
      h.mail.clear();

      await h
        .http()
        .patch('/auth/password')
        .set(...h.bearer(session))
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: NEW_PASSWORD })
        .expect(200);
      await h.drainTasks();

      expect(h.mail.latestTo(account.email)?.subject).toBe('Your Gridline password was changed');
      const actions = (await h.dataSource.getRepository(AuditLogEntry).find()).map((entry) => entry.action);
      expect(actions).toContain('auth.password_changed');
    });

    it('needs a token', async () => {
      await h
        .http()
        .patch('/auth/password')
        .send({ currentPassword: DEFAULT_PASSWORD, newPassword: NEW_PASSWORD })
        .expect(401);
    });
  });
});
