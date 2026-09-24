import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, DEFAULT_PASSWORD, type RegisteredAccount } from '#test/support/app-harness.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { RefreshToken } from '#/database/entities/refresh-token.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from './auth.constants.js';

describe('login, refresh and logout (integration)', () => {
  let h: AppHarness;
  let account: RegisteredAccount;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    account = await h.registerAndActivate();
  });

  afterAll(() => h.stop());

  function refresh(refreshToken: string) {
    return h.http().post('/auth/refresh').send({ refreshToken });
  }

  describe('login', () => {
    it('returns a bearer pair with the access token lifetime', async () => {
      const response = await h
        .http()
        .post('/auth/login')
        .send({ email: account.email, password: account.password })
        .expect(200);

      expect(response.body).toMatchObject({ tokenType: 'Bearer', expiresIn: ACCESS_TOKEN_TTL_SECONDS });
      expect(Object.keys(response.body).sort()).toEqual([
        'accessToken',
        'expiresIn',
        'refreshToken',
        'tokenType',
      ]);
    });

    it('answers a wrong password and an unknown email identically', async () => {
      const wrongPassword = await h
        .http()
        .post('/auth/login')
        .send({ email: account.email, password: 'not-the-password' })
        .expect(401);
      const unknownEmail = await h
        .http()
        .post('/auth/login')
        .send({ email: 'ghost@nowhere.test', password: DEFAULT_PASSWORD })
        .expect(401);

      expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
    });

    it('is case-insensitive on the email', async () => {
      await h.login(account.email.toUpperCase());
    });

    it('rejects a malformed body before touching the database', async () => {
      await h.http().post('/auth/login').send({ email: 'nope' }).expect(400);
      await h.http().post('/auth/login').send({}).expect(400);
    });

    it('records lastUsedAt on the identity', async () => {
      h.clock.advance(3 * 60 * 60_000);
      await h.login(account.email);

      const identity = await h.dataSource
        .getRepository(AuthIdentity)
        .findOneByOrFail({ userId: account.userId });
      expect(identity.lastUsedAt?.toISOString()).toBe(h.clock.now().toISOString());
    });

    it('refuses a disabled user with the right password', async () => {
      await h.dataSource.getRepository(User).update({ id: account.userId }, { status: 'disabled' });

      const response = await h
        .http()
        .post('/auth/login')
        .send({ email: account.email, password: account.password })
        .expect(403);
      expect(response.body.message).toMatch(/disabled/i);
    });

    it('never stores the refresh token itself', async () => {
      const session = await h.login(account.email);

      const tokens = await h.dataSource.getRepository(RefreshToken).find();
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.tokenHash).not.toBe(session.refreshToken);
      expect(tokens[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('the access token', () => {
    it('opens a protected route', async () => {
      const session = await h.login(account.email);

      await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
    });

    it('expires after 15 minutes — measured on the injected clock', async () => {
      const session = await h.login(account.email);

      h.clock.advance((ACCESS_TOKEN_TTL_SECONDS - 5) * 1_000);
      await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);

      h.clock.advance(10 * 1_000);
      await h.http().get('/auth/me').set(...h.bearer(session)).expect(401);
    });

    it('is replaced by refreshing, and the new one works', async () => {
      const session = await h.login(account.email);
      h.clock.advance((ACCESS_TOKEN_TTL_SECONDS + 60) * 1_000);
      await h.http().get('/auth/me').set(...h.bearer(session)).expect(401);

      const renewed = h.parseSession((await refresh(session.refreshToken).expect(200)).body);

      await h.http().get('/auth/me').set(...h.bearer(renewed)).expect(200);
    });
  });

  describe('refresh rotation', () => {
    it('spends the old token and issues a new one', async () => {
      const first = await h.login(account.email);

      const second = h.parseSession((await refresh(first.refreshToken).expect(200)).body);

      expect(second.refreshToken).not.toBe(first.refreshToken);
      await refresh(second.refreshToken).expect(200);
    });

    it('treats presenting a spent token as theft and revokes the whole family', async () => {
      const first = await h.login(account.email);
      const second = h.parseSession((await refresh(first.refreshToken).expect(200)).body);

      // The thief (or the slow legitimate client) replays the first token…
      await refresh(first.refreshToken).expect(401);
      // …and the newest token, which was perfectly valid a moment ago, is now dead too.
      await refresh(second.refreshToken).expect(401);
    });

    it('keeps separate logins in separate families', async () => {
      const laptop = await h.login(account.email);
      const phone = await h.login(account.email);

      // Replay on the laptop's family…
      const rotated = h.parseSession((await refresh(laptop.refreshToken).expect(200)).body);
      await refresh(laptop.refreshToken).expect(401);
      await refresh(rotated.refreshToken).expect(401);

      // …must not sign the phone out.
      await refresh(phone.refreshToken).expect(200);
    });

    it('lets exactly one of two simultaneous refreshes with the same token succeed', async () => {
      const session = await h.login(account.email);

      const statuses = (
        await Promise.all([refresh(session.refreshToken), refresh(session.refreshToken)])
      )
        .map((response) => response.status)
        .sort();

      expect(statuses).toEqual([200, 401]);
    });

    it('links each token to its successor', async () => {
      const first = await h.login(account.email);
      await refresh(first.refreshToken).expect(200);

      const tokens = await h.dataSource.getRepository(RefreshToken).find({ order: { createdAt: 'ASC' } });
      expect(tokens).toHaveLength(2);
      const [old, next] = tokens;
      expect(old?.replacedById).toBe(next?.id);
      expect(old?.familyId).toBe(next?.familyId);
    });

    it('expires after 30 days', async () => {
      const session = await h.login(account.email);

      h.clock.advance(REFRESH_TOKEN_TTL_MS + 1_000);

      await refresh(session.refreshToken).expect(401);
    });

    it('rejects a token it never issued', async () => {
      await refresh('never-issued').expect(401);
    });

    it('refuses to renew a session for a user disabled since', async () => {
      const session = await h.login(account.email);
      await h.dataSource.getRepository(User).update({ id: account.userId }, { status: 'disabled' });

      await refresh(session.refreshToken).expect(401);
    });
  });

  describe('logout', () => {
    it('ends the session: the refresh token stops working', async () => {
      const session = await h.login(account.email);

      await h.http().post('/auth/logout').send({ refreshToken: session.refreshToken }).expect(200);

      await refresh(session.refreshToken).expect(401);
    });

    it('revokes the whole family, so a rotated-away token is dead too', async () => {
      const first = await h.login(account.email);
      const second = h.parseSession((await refresh(first.refreshToken).expect(200)).body);

      await h.http().post('/auth/logout').send({ refreshToken: second.refreshToken }).expect(200);

      await refresh(second.refreshToken).expect(401);
    });

    it('answers 200 for a token it does not know, revealing nothing', async () => {
      await h.http().post('/auth/logout').send({ refreshToken: 'never-issued' }).expect(200);
    });

    it('works with an expired access token, since that is when people sign out', async () => {
      const session = await h.login(account.email);
      h.clock.advance((ACCESS_TOKEN_TTL_SECONDS + 60) * 1_000);

      await h.http().post('/auth/logout').send({ refreshToken: session.refreshToken }).expect(200);
    });
  });
});
