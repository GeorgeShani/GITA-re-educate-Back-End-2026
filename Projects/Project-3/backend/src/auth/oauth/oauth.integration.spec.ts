import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AppHarness,
  DEFAULT_PASSWORD,
  type GoogleFlowResult,
  type SessionBody,
} from '#test/support/app-harness.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { AuthToken } from '#/database/entities/auth-token.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';

const SESSION_PAGE = '/session/oauth-complete';
const REGISTER_PAGE = '/register';
const LINK_PAGE = '/settings/linked-accounts';

const meSchema = z.object({ user: z.object({ id: z.uuid() }) });
const identitiesSchema = z.object({
  data: z.array(z.object({ id: z.uuid(), provider: z.string() }).loose()),
});
const registeredSchema = z.object({
  companyId: z.uuid(),
  userId: z.uuid(),
  status: z.enum(['pending_activation', 'active']),
  session: z
    .object({ accessToken: z.string(), refreshToken: z.string(), tokenType: z.string(), expiresIn: z.number() })
    .nullable(),
});

describe('Google sign-in and linked accounts (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  // ---- helpers ------------------------------------------------------------

  const codeOf = (result: GoogleFlowResult): string => {
    expect(result.location.pathname, result.location.toString()).toBe(SESSION_PAGE);
    const code = result.location.searchParams.get('code');
    expect(code, result.location.toString()).toBeTruthy();
    return code ?? '';
  };

  const errorOf = (result: GoogleFlowResult): string | null => result.location.searchParams.get('error');

  async function sessionFrom(result: GoogleFlowResult): Promise<SessionBody> {
    const response = await h.exchangeOAuthCode(codeOf(result));
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    return h.parseSession(response.body);
  }

  async function whoAmI(session: SessionBody): Promise<string> {
    const response = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
    return meSchema.parse(response.body).user.id;
  }

  async function adminSession() {
    const admin = await h.registerAndActivate();
    return { admin, session: await h.login(admin.email) };
  }

  async function identitiesOf(session: SessionBody) {
    const response = await h.http().get('/auth/identities').set(...h.bearer(session)).expect(200);
    return identitiesSchema.parse(response.body).data;
  }

  async function actionsFor(companyId: string): Promise<string[]> {
    const rows = await h.dataSource
      .getRepository(AuditLogEntry)
      .find({ where: { companyId }, order: { createdAt: 'ASC', id: 'ASC' } });
    return rows.map((row) => row.action);
  }

  /** A company with a Basic plan and one invited (not yet accepted) employee. */
  async function invitedEmployee(workEmail = 'work@acme.test') {
    const { admin, session } = await adminSession();
    await h.subscribe(session, 'basic');
    const invited = await h.inviteEmployee(session, { email: workEmail });
    return { admin, session, ...invited, token: h.mail.latestTokenTo(invited.email) };
  }

  /** Runs a `register` flow and returns the registration token the callback hands the frontend. */
  async function registrationTokenFor(profile: Parameters<AppHarness['googleFlow']>[0]['profile']) {
    const result = await h.googleFlow({ intent: 'register', profile });
    expect(result.location.pathname, result.location.toString()).toBe(REGISTER_PAGE);
    const token = result.location.searchParams.get('oauthRegistration');
    expect(token).toBeTruthy();
    return token ?? '';
  }

  const COMPANY = { companyName: 'Google Co', country: 'GE', industry: 'technology' };

  // ---- starting a flow ----------------------------------------------------

  describe('POST /auth/oauth/google/url', () => {
    it('returns the provider URL and pins the flow to this browser with an httpOnly cookie', async () => {
      const response = await h.http().post('/auth/oauth/google/url').send({ intent: 'login' }).expect(200);

      expect(new URL(response.body.url).searchParams.get('state')).toBeTruthy();
      const cookie = String(response.headers['set-cookie']);
      expect(cookie).toMatch(/^gl_oauth_nonce=/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it.each([
      ['an unknown intent', { intent: 'admin' }],
      ['`link`, which needs a signed-in user and its own route', { intent: 'link' }],
      ['an invite intent with no invite token', { intent: 'invite' }],
      ['an unknown field', { intent: 'login', role: 'admin' }],
    ])('rejects %s', async (_name, body) => {
      await h.http().post('/auth/oauth/google/url').send(body).expect(400);
    });

    it('refuses to start an invite flow from a dead invite link, before any trip to Google', async () => {
      await h.http().post('/auth/oauth/google/url').send({ intent: 'invite', inviteToken: 'nope' }).expect(400);
    });

    it('refuses an invite link that has been superseded by a resend', async () => {
      const { session, userId, token } = await invitedEmployee();
      await h
        .http()
        .post(`/employees/${userId}/resend-invite`)
        .set(...h.bearer(session))
        .expect(200);

      await h.http().post('/auth/oauth/google/url').send({ intent: 'invite', inviteToken: token }).expect(400);
    });

    it('needs a signed-in user to start a link', async () => {
      await h.http().post('/auth/identities/google/link').expect(401);
    });
  });

  // ---- the callback's own checks ------------------------------------------

  describe('callback state checks', () => {
    it('refuses a callback whose browser never started the flow (no cookie)', async () => {
      const start = await h.googleStart({ intent: 'login' });
      const result = await h.googleCallback(start, h.google.issueCode({ providerUserId: 'g-x' }), { cookie: null });

      expect(errorOf(result)).toBe('invalid_state');
    });

    it('refuses a callback carrying a different browser’s cookie — login CSRF', async () => {
      // The attacker starts a flow and gets a state; the victim's browser has its own cookie.
      const attacker = await h.googleStart({ intent: 'login' });
      const victim = await h.googleStart({ intent: 'login' });
      const result = await h.googleCallback(attacker, h.google.issueCode(), { cookie: victim.cookie });

      expect(errorOf(result)).toBe('invalid_state');
    });

    it('refuses a forged state', async () => {
      const start = await h.googleStart({ intent: 'login' });
      const result = await h.googleCallback(start, h.google.issueCode(), { state: `${start.state}x` });

      expect(errorOf(result)).toBe('invalid_state');
    });

    it('refuses a callback with no state at all', async () => {
      const response = await h.http().get('/auth/google/callback').query({ code: 'whatever' }).expect(302);
      expect(new URL(String(response.headers['location'])).searchParams.get('error')).toBe('invalid_state');
    });

    it('refuses an expired state (the person took too long at Google)', async () => {
      const start = await h.googleStart({ intent: 'login' });
      h.clock.advance(11 * 60_000);

      expect(errorOf(await h.googleCallback(start, h.google.issueCode()))).toBe('invalid_state');
    });

    it('does not fail on the extra parameters Google appends', async () => {
      const start = await h.googleStart({ intent: 'login' });
      const code = h.google.issueCode({ providerUserId: 'g-extra' });
      const response = await h
        .http()
        .get('/auth/google/callback')
        .query({ code, state: start.state, scope: 'email profile', authuser: '0', prompt: 'none', hd: 'acme.test' })
        .set('Cookie', start.cookie)
        .expect(302);

      expect(new URL(String(response.headers['location'])).pathname).toBe(REGISTER_PAGE);
    });

    it('reports a person cancelling at Google as access_denied', async () => {
      const start = await h.googleStart({ intent: 'login' });
      const response = await h
        .http()
        .get('/auth/google/callback')
        .query({ error: 'access_denied', state: start.state })
        .set('Cookie', start.cookie)
        .expect(302);

      expect(new URL(String(response.headers['location'])).searchParams.get('error')).toBe('access_denied');
    });

    it('reports a code Google rejects as provider_error', async () => {
      const start = await h.googleStart({ intent: 'login' });
      expect(errorOf(await h.googleCallback(start, 'a-code-google-never-issued'))).toBe('provider_error');
    });

    it('rejects a code that has already been used', async () => {
      const start = await h.googleStart({ intent: 'login' });
      const code = h.google.issueCode({ providerUserId: 'g-once' });

      await h.googleCallback(start, code);
      expect(errorOf(await h.googleCallback(start, code))).toBe('provider_error');
    });

    it('never puts a token in the URL — only a short opaque code', async () => {
      const { admin } = await adminSession();
      await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-1', email: admin.email, emailVerified: true } });
      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-1', email: admin.email, emailVerified: true },
      });

      const url = result.location.toString();
      expect(url).not.toMatch(/accessToken|refreshToken|eyJ/);
      expect(result.location.searchParams.get('code')).not.toContain('.');
    });
  });

  // ---- registering a company with Google ----------------------------------

  describe('registering a company with Google', () => {
    it('an unknown Google account is offered registration, never silently joined to anything', async () => {
      await adminSession();
      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-new', email: 'stranger@elsewhere.test', emailVerified: true },
      });

      expect(result.location.pathname).toBe(REGISTER_PAGE);
      expect(result.location.searchParams.get('oauthRegistration')).toBeTruthy();
      expect(await h.dataSource.getRepository(Company).count()).toBe(1);
    });

    it('prefills the form from the Google account', async () => {
      const token = await registrationTokenFor({
        providerUserId: 'g-1',
        email: 'Owner@Acme.test',
        emailVerified: true,
        name: 'Owen Owner',
      });

      const preview = await h.http().post('/auth/oauth/registration/preview').send({ oauthRegistrationToken: token }).expect(200);

      expect(preview.body).toEqual({ email: 'owner@acme.test', emailVerified: true, name: 'Owen Owner' });
    });

    describe('with an address Google vouches for', () => {
      const profile = { providerUserId: 'g-owner', email: 'owner@acme.test', emailVerified: true, name: 'Owen Owner' };

      it('activates the company at once, skips the activation email, and signs the person in', async () => {
        const token = await registrationTokenFor(profile);

        const response = await h
          .http()
          .post('/auth/oauth/register-company')
          .send({ ...COMPANY, oauthRegistrationToken: token })
          .expect(201);
        const registered = registeredSchema.parse(response.body);
        await h.drainTasks();

        expect(registered.status).toBe('active');
        expect(h.mail.sent).toHaveLength(0);
        expect(await h.dataSource.getRepository(BackgroundTask).count()).toBe(0);
        const company = await h.dataSource.getRepository(Company).findOneByOrFail({ id: registered.companyId });
        expect(company).toMatchObject({ status: 'active', billingEmail: 'owner@acme.test', country: 'GE' });
        const user = await h.dataSource.getRepository(User).findOneByOrFail({ id: registered.userId });
        expect(user).toMatchObject({ role: 'admin', status: 'active', fullName: 'Owen Owner', email: 'owner@acme.test' });

        const session = registered.session;
        expect(session).not.toBeNull();
        if (session) expect(await whoAmI(h.parseSession(session))).toBe(registered.userId);
      });

      it('creates a Google identity and NO password identity', async () => {
        const token = await registrationTokenFor(profile);
        const { userId } = registeredSchema.parse(
          (await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: token }).expect(201)).body,
        );

        const identities = await h.dataSource.getRepository(AuthIdentity).find({ where: { userId } });
        expect(identities).toHaveLength(1);
        expect(identities[0]).toMatchObject({
          provider: 'google',
          providerUserId: 'g-owner',
          passwordHash: null,
          emailVerified: true,
        });
        // There is no password to guess for this account.
        await h.http().post('/auth/login').send({ email: 'owner@acme.test', password: DEFAULT_PASSWORD }).expect(401);
      });

      it('audits the registration and the activation, attributing them to the new admin', async () => {
        const token = await registrationTokenFor(profile);
        const { companyId } = registeredSchema.parse(
          (await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: token }).expect(201)).body,
        );

        // Same transaction, same timestamp: the pair, not an order.
        expect((await actionsFor(companyId)).sort()).toEqual(['company.activated', 'company.registered']);
      });

      it('lets them sign in with Google afterwards', async () => {
        const token = await registrationTokenFor(profile);
        const { userId } = registeredSchema.parse(
          (await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: token }).expect(201)).body,
        );

        const signedIn = await sessionFrom(await h.googleFlow({ intent: 'login', profile }));
        expect(await whoAmI(signedIn)).toBe(userId);
      });

      it('rejects a different `email` in the form: only the vouched-for address skips activation', async () => {
        const token = await registrationTokenFor(profile);
        await h
          .http()
          .post('/auth/oauth/register-company')
          .send({ ...COMPANY, oauthRegistrationToken: token, email: 'someone.else@acme.test' })
          .expect(400);

        expect(await h.dataSource.getRepository(Company).count()).toBe(0);
      });

      it('accepts the same `email` in the form', async () => {
        const token = await registrationTokenFor(profile);
        await h
          .http()
          .post('/auth/oauth/register-company')
          .send({ ...COMPANY, oauthRegistrationToken: token, email: 'OWNER@acme.test' })
          .expect(201);
      });
    });

    describe('with an address Google does not vouch for', () => {
      const profile = { providerUserId: 'g-unv', email: 'owner@acme.test', emailVerified: false, name: 'Owen' };

      it('needs `email` in the form, then behaves like a password registration: activation email, no session', async () => {
        const token = await registrationTokenFor(profile);

        const response = await h
          .http()
          .post('/auth/oauth/register-company')
          .send({ ...COMPANY, oauthRegistrationToken: token, email: 'owner@acme.test' })
          .expect(201);
        const registered = registeredSchema.parse(response.body);
        await h.drainTasks();

        expect(registered).toMatchObject({ status: 'pending_activation', session: null });
        expect(h.mail.to('owner@acme.test')).toHaveLength(1);
        expect(await actionsFor(registered.companyId)).toEqual(['company.registered']);
      });

      it('is refused a session by Google until the activation link is used', async () => {
        const token = await registrationTokenFor(profile);
        await h
          .http()
          .post('/auth/oauth/register-company')
          .send({ ...COMPANY, oauthRegistrationToken: token, email: 'owner@acme.test' })
          .expect(201);
        await h.drainTasks();

        expect(errorOf(await h.googleFlow({ intent: 'login', profile }))).toBe('not_activated');

        await h.http().get('/auth/activate').query({ token: h.mail.latestTokenTo('owner@acme.test') }).expect(200);
        expect(codeOf(await h.googleFlow({ intent: 'login', profile }))).toBeTruthy();
      });

      it('demands an address rather than silently trusting the unverified one', async () => {
        const token = await registrationTokenFor(profile);
        await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: token }).expect(400);
      });
    });

    describe('with a relay address', () => {
      const profile = { providerUserId: 'g-relay', email: 'x1y2z3@privaterelay.appleid.com', emailVerified: true };

      it('is never used as the contact address: the preview withholds it and the form must supply one', async () => {
        const token = await registrationTokenFor(profile);

        const preview = await h.http().post('/auth/oauth/registration/preview').send({ oauthRegistrationToken: token }).expect(200);
        expect(preview.body).toMatchObject({ email: null, emailVerified: false });

        await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: token }).expect(400);
      });

      it('registers with a real address, sends mail only to it, and remembers the relay as the identity email', async () => {
        const token = await registrationTokenFor(profile);
        const { userId } = registeredSchema.parse(
          (await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: token, email: 'real@acme.test' }).expect(201)).body,
        );
        await h.drainTasks();

        expect(h.mail.sent.map((mail) => mail.to)).toEqual(['real@acme.test']);
        const identity = await h.dataSource.getRepository(AuthIdentity).findOneByOrFail({ userId });
        expect(identity.email).toBe('x1y2z3@privaterelay.appleid.com');
      });
    });

    it('rejects a tampered, expired or foreign registration token', async () => {
      const token = await registrationTokenFor({ providerUserId: 'g-t', email: 'a@acme.test', emailVerified: true });
      const post = (oauthRegistrationToken: string) =>
        h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken });

      await post(`${token}x`).expect(400);
      await post('garbage').expect(400);
      // A state token is not a registration token.
      await post((await h.googleStart({ intent: 'login' })).state).expect(400);

      h.clock.advance(16 * 60_000);
      await post(token).expect(400);
      expect(await h.dataSource.getRepository(Company).count()).toBe(0);
    });

    it('cannot register the same Google account twice, nor an address that already has a company', async () => {
      const profile = { providerUserId: 'g-dup', email: 'dup@acme.test', emailVerified: true };
      const first = await registrationTokenFor(profile);
      const second = await registrationTokenFor(profile);

      await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: first }).expect(201);
      await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: second }).expect(409);
      expect(await h.dataSource.getRepository(Company).count()).toBe(1);
    });

    it.each(['companyName', 'country', 'industry', 'oauthRegistrationToken'])(
      'rejects a registration missing %s',
      async (field) => {
        const token = await registrationTokenFor({ providerUserId: 'g-m', email: 'm@acme.test', emailVerified: true });
        const body: Record<string, unknown> = { ...COMPANY, oauthRegistrationToken: token };
        delete body[field];

        await h.http().post('/auth/oauth/register-company').send(body).expect(400);
      },
    );

    it('rejects a field it does not know', async () => {
      const token = await registrationTokenFor({ providerUserId: 'g-u', email: 'u@acme.test', emailVerified: true });
      await h
        .http()
        .post('/auth/oauth/register-company')
        .send({ ...COMPANY, oauthRegistrationToken: token, role: 'admin', status: 'active' })
        .expect(400);
    });
  });

  // ---- signing in ---------------------------------------------------------

  describe('signing in', () => {
    it('signs in by (provider, sub) alone, whatever email Google now reports', async () => {
      const { admin, session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-known', email: 'personal@gmail.test' } });

      // Google now reports a completely different, unverified address. It is never consulted.
      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-known', email: 'brand-new@elsewhere.test', emailVerified: false },
      });

      expect(await whoAmI(await sessionFrom(result))).toBe(admin.userId);
    });

    it('records the sign-in on the identity', async () => {
      const { session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-lu' } });
      h.clock.advance(3_600_000);
      await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-lu' } });

      const identity = await h.dataSource
        .getRepository(AuthIdentity)
        .findOneByOrFail({ provider: 'google', providerUserId: 'g-lu' });
      expect(identity.lastUsedAt?.toISOString()).toBe(h.clock.now().toISOString());
    });

    it('starts an independent session each time (own refresh family)', async () => {
      const { session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-fam' } });

      const first = await sessionFrom(await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-fam' } }));
      const second = await sessionFrom(await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-fam' } }));

      expect(first.refreshToken).not.toBe(second.refreshToken);
      await h.http().post('/auth/refresh').send({ refreshToken: first.refreshToken }).expect(200);
      await h.http().post('/auth/refresh').send({ refreshToken: second.refreshToken }).expect(200);
    });

    it('refuses a user who has since been disabled or whose company was suspended', async () => {
      const { admin, session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-susp' } });
      await h.dataSource.getRepository(Company).update({ id: admin.companyId }, { status: 'suspended' });

      expect(errorOf(await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-susp' } }))).toBe(
        'account_unavailable',
      );
    });
  });

  describe('auto-linking by email (the narrow path)', () => {
    it('links a VERIFIED address that exactly matches one active user, case-insensitively, then signs them in', async () => {
      const admin = await h.registerAndActivate({ email: 'boss@acme.test' });

      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-boss', email: 'BOSS@Acme.test', emailVerified: true },
      });

      expect(await whoAmI(await sessionFrom(result))).toBe(admin.userId);
      const identity = await h.dataSource.getRepository(AuthIdentity).findOneByOrFail({ provider: 'google', userId: admin.userId });
      expect(identity.providerUserId).toBe('g-boss');
      expect(await actionsFor(admin.companyId)).toContain('auth.identity_linked');
    });

    it('does NOT link an UNVERIFIED matching address — that is how accounts get taken over', async () => {
      const admin = await h.registerAndActivate({ email: 'boss@acme.test' });

      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-attacker', email: 'boss@acme.test', emailVerified: false },
      });

      expect(result.location.pathname).toBe(REGISTER_PAGE);
      expect(await h.dataSource.getRepository(AuthIdentity).countBy({ userId: admin.userId, provider: 'google' })).toBe(0);
    });

    it('does NOT link on a relay address even when Google calls it verified', async () => {
      await h.registerAndActivate({ email: 'boss@privaterelay.appleid.com' });

      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-relay', email: 'boss@privaterelay.appleid.com', emailVerified: true },
      });

      expect(result.location.pathname).toBe(REGISTER_PAGE);
    });

    it('does NOT link to a user who has not yet activated', async () => {
      const admin = await h.registerAndActivate();
      await h.seedEmployee(admin.companyId, { email: 'pending@acme.test', status: 'invited' });

      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-p', email: 'pending@acme.test', emailVerified: true },
      });

      expect(result.location.pathname).toBe(REGISTER_PAGE);
    });

    it('refuses rather than guesses when two companies each have someone at that address', async () => {
      const a = await h.registerAndActivate({ email: 'shared@acme.test' });
      const b = await h.registerAndActivate();
      await h.dataSource.getRepository(User).save(
        h.dataSource.getRepository(User).create({
          companyId: b.companyId,
          email: 'shared@acme.test',
          fullName: 'Same Address',
          role: 'employee',
          status: 'active',
          activatedAt: h.clock.now(),
          disabledAt: null,
        }),
      );

      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-amb', email: 'shared@acme.test', emailVerified: true },
      });

      expect(errorOf(result)).toBe('ambiguous_email');
      expect(await h.dataSource.getRepository(AuthIdentity).countBy({ userId: a.userId, provider: 'google' })).toBe(0);
    });

    it('refuses when the matching user’s company is suspended', async () => {
      const admin = await h.registerAndActivate({ email: 'boss@acme.test' });
      await h.dataSource.getRepository(Company).update({ id: admin.companyId }, { status: 'suspended' });

      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-s', email: 'boss@acme.test', emailVerified: true },
      });

      expect(errorOf(result)).toBe('account_unavailable');
    });

    it('refuses to link a second, different Google account to a user who already has one', async () => {
      const admin = await h.registerAndActivate({ email: 'boss@acme.test' });
      const session = await h.login(admin.email);
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-first' } });

      const result = await h.googleFlow({
        intent: 'login',
        profile: { providerUserId: 'g-second', email: 'boss@acme.test', emailVerified: true },
      });

      expect(errorOf(result)).toBe('already_linked');
      expect(await h.dataSource.getRepository(AuthIdentity).countBy({ userId: admin.userId, provider: 'google' })).toBe(1);
    });
  });

  // ---- accepting an invite with Google (the graded proof) ----------------

  describe('accepting an invitation with Google', () => {
    it('binds a Google account whose email does NOT match the invited address — the invite link is the proof', async () => {
      const { admin, token, userId, email } = await invitedEmployee('giorgi@acme.test');

      const result = await h.googleFlow({
        intent: 'invite',
        inviteToken: token,
        profile: {
          providerUserId: 'g-giorgi',
          email: 'giorgi.personal@gmail.test',
          emailVerified: true,
          name: 'Giorgi P.',
        },
      });
      const session = await sessionFrom(result);

      expect(await whoAmI(session)).toBe(userId);

      // Still the WORK address on the user; Google's address lives on the identity.
      const user = await h.dataSource.getRepository(User).findOneByOrFail({ id: userId });
      expect(user).toMatchObject({ status: 'active', email });
      expect(user.activatedAt?.toISOString()).toBe(h.clock.now().toISOString());
      const identity = await h.dataSource.getRepository(AuthIdentity).findOneByOrFail({ userId });
      expect(identity).toMatchObject({
        provider: 'google',
        providerUserId: 'g-giorgi',
        email: 'giorgi.personal@gmail.test',
        passwordHash: null,
      });

      expect(await actionsFor(admin.companyId)).toContain('employee.accepted_invite');
    });

    it('starts billing: opens a seat interval at the moment of acceptance', async () => {
      const { userId, token } = await invitedEmployee();
      h.clock.advance(2 * 86_400_000);

      await h.googleFlow({ intent: 'invite', inviteToken: token, profile: { providerUserId: 'g-seat' } });

      const intervals = await h.dataSource.getRepository(SeatInterval).find({ where: { userId } });
      expect(intervals).toHaveLength(1);
      expect(intervals[0]?.activeFrom.toISOString()).toBe(h.clock.now().toISOString());
      expect(intervals[0]?.activeTo).toBeNull();
    });

    it('also works for a relay address and for a provider that reports no email at all', async () => {
      const relay = await invitedEmployee('one@acme.test');
      const relayResult = await h.googleFlow({
        intent: 'invite',
        inviteToken: relay.token,
        profile: { providerUserId: 'g-r', email: 'zzz@privaterelay.appleid.com', emailVerified: true },
      });
      expect(await whoAmI(await sessionFrom(relayResult))).toBe(relay.userId);

      h.mail.clear();
      const bare = await invitedEmployee('two@acme.test');
      const bareResult = await h.googleFlow({
        intent: 'invite',
        inviteToken: bare.token,
        profile: { providerUserId: 'g-b', email: null, emailVerified: false },
      });
      expect(await whoAmI(await sessionFrom(bareResult))).toBe(bare.userId);
    });

    it('spends the invitation: the same link cannot then set a password', async () => {
      const { token } = await invitedEmployee();
      await h.googleFlow({ intent: 'invite', inviteToken: token, profile: { providerUserId: 'g-1' } });

      await h.http().post('/auth/accept-invite').send({ token, password: DEFAULT_PASSWORD }).expect(400);
    });

    it('leaves the employee with no password to sign in with', async () => {
      const { email, token } = await invitedEmployee();
      await h.googleFlow({ intent: 'invite', inviteToken: token, profile: { providerUserId: 'g-1' } });

      await h.http().post('/auth/login').send({ email, password: DEFAULT_PASSWORD }).expect(401);
    });

    it('signs the employee back in with Google on a later visit', async () => {
      const { userId, token } = await invitedEmployee();
      await h.googleFlow({ intent: 'invite', inviteToken: token, profile: { providerUserId: 'g-again' } });

      const session = await sessionFrom(await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-again' } }));
      expect(await whoAmI(session)).toBe(userId);
    });

    it('refuses a Google account that already belongs to someone else, and leaves the invitation usable', async () => {
      const { session, token } = await invitedEmployee();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-taken' } });

      const result = await h.googleFlow({ intent: 'invite', inviteToken: token, profile: { providerUserId: 'g-taken' } });

      expect(errorOf(result)).toBe('identity_in_use');
      // Nothing was spent: they can still accept with a password.
      await h.http().post('/auth/accept-invite').send({ token, password: DEFAULT_PASSWORD }).expect(200);
    });

    it('refuses when the invitation is spent between starting and finishing', async () => {
      const { token } = await invitedEmployee();
      const start = await h.googleStart({ intent: 'invite', inviteToken: token });
      await h.http().post('/auth/accept-invite').send({ token, password: DEFAULT_PASSWORD }).expect(200);

      const result = await h.googleCallback(start, h.google.issueCode({ providerUserId: 'g-late' }));

      expect(errorOf(result)).toBe('invalid_invite');
      expect(await h.dataSource.getRepository(AuthIdentity).countBy({ provider: 'google' })).toBe(0);
    });

    it('refuses when the invitation expires while the person is at Google', async () => {
      const { token } = await invitedEmployee();
      const start = await h.googleStart({ intent: 'invite', inviteToken: token });
      h.clock.advance(8 * 86_400_000);

      const result = await h.googleCallback(start, h.google.issueCode({ providerUserId: 'g-exp' }));

      // The state itself has expired first; either way nothing binds.
      expect(errorOf(result)).not.toBeNull();
      expect(await h.dataSource.getRepository(AuthIdentity).countBy({ provider: 'google' })).toBe(0);
    });

    it('is one-shot per invite: two people racing the same link cannot both bind', async () => {
      const { token } = await invitedEmployee();
      const [first, second] = await Promise.all([
        h.googleStart({ intent: 'invite', inviteToken: token }),
        h.googleStart({ intent: 'invite', inviteToken: token }),
      ]);

      const results = await Promise.all([
        h.googleCallback(first, h.google.issueCode({ providerUserId: 'g-race-1' })),
        h.googleCallback(second, h.google.issueCode({ providerUserId: 'g-race-2' })),
      ]);

      expect(results.filter((result) => result.location.searchParams.has('code'))).toHaveLength(1);
      expect(results.filter((result) => errorOf(result) === 'invalid_invite')).toHaveLength(1);
      expect(await h.dataSource.getRepository(AuthIdentity).countBy({ provider: 'google' })).toBe(1);
    });
  });

  // ---- linked accounts ----------------------------------------------------

  describe('linking and unlinking', () => {
    it('links Google to the signed-in user with NO email comparison, whatever address it reports', async () => {
      const { admin, session } = await adminSession();

      const result = await h.googleFlow({
        intent: 'link',
        session,
        profile: { providerUserId: 'g-l', email: 'totally-different@gmail.test', emailVerified: true },
      });

      expect(result.location.pathname).toBe(LINK_PAGE);
      expect(result.location.searchParams.get('linked')).toBe('google');
      const identities = await identitiesOf(session);
      expect(identities.map((identity) => identity.provider).sort()).toEqual(['google', 'password']);
      expect(await actionsFor(admin.companyId)).toContain('auth.identity_linked');
    });

    it('never exposes a password hash or the provider’s subject', async () => {
      const { session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-secret-sub' } });

      const response = await h.http().get('/auth/identities').set(...h.bearer(session)).expect(200);

      expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|scrypt|g-secret-sub|providerUserId/);
    });

    it('is idempotent: linking the same Google account again changes nothing', async () => {
      const { session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-same' } });

      const again = await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-same' } });

      expect(again.location.searchParams.get('linked')).toBe('google');
      expect(await identitiesOf(session)).toHaveLength(2);
    });

    it('refuses a Google account that already belongs to another user', async () => {
      const { session } = await adminSession();
      const other = await adminSession();
      await h.googleFlow({ intent: 'link', session: other.session, profile: { providerUserId: 'g-theirs' } });

      const result = await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-theirs' } });

      expect(result.location.pathname).toBe(LINK_PAGE);
      expect(errorOf(result)).toBe('identity_in_use');
      expect(await identitiesOf(session)).toHaveLength(1);
    });

    it('refuses a second, different Google account for the same user', async () => {
      const { session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-one' } });

      const result = await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-two' } });

      expect(errorOf(result)).toBe('already_linked');
      expect(await identitiesOf(session)).toHaveLength(2);
    });

    it('will not complete a link started in another browser', async () => {
      const { session } = await adminSession();
      const start = await h.googleStart({ intent: 'link', session });
      const stranger = await h.googleStart({ intent: 'login' });

      const result = await h.googleCallback(start, h.google.issueCode({ providerUserId: 'g-x' }), {
        cookie: stranger.cookie,
      });

      expect(errorOf(result)).toBe('invalid_state');
      expect(await identitiesOf(session)).toHaveLength(1);
    });

    it('refuses to finish a link for someone removed while they were at Google', async () => {
      const { session, admin } = await adminSession();
      await h.subscribe(session, 'basic');
      const employee = await h.inviteAndAccept(session, admin.companyId);
      const start = await h.googleStart({ intent: 'link', session: employee.session });

      await h.http().delete(`/employees/${employee.userId}`).set(...h.bearer(session)).expect(200);
      const result = await h.googleCallback(start, h.google.issueCode({ providerUserId: 'g-gone' }));

      expect(errorOf(result)).toBe('account_unavailable');
      expect(await h.dataSource.getRepository(AuthIdentity).countBy({ provider: 'google' })).toBe(0);
    });

    it('unlinks Google, after which that Google account no longer signs in', async () => {
      const { session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-bye' } });
      const google = (await identitiesOf(session)).find((identity) => identity.provider === 'google');

      await h.http().delete(`/auth/identities/${google?.id}`).set(...h.bearer(session)).expect(200);

      expect(await identitiesOf(session)).toHaveLength(1);
      const result = await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-bye' } });
      expect(result.location.pathname).toBe(REGISTER_PAGE);
    });

    it('refuses to remove the last way to sign in', async () => {
      const { session } = await adminSession();
      const [only] = await identitiesOf(session);

      const response = await h.http().delete(`/auth/identities/${only?.id}`).set(...h.bearer(session)).expect(409);

      expect(response.body.message).toMatch(/only way to sign in/i);
      expect(await identitiesOf(session)).toHaveLength(1);
    });

    it('protects a Google-only account the same way', async () => {
      const token = await registrationTokenFor({ providerUserId: 'g-solo', email: 'solo@acme.test', emailVerified: true });
      const registered = registeredSchema.parse(
        (await h.http().post('/auth/oauth/register-company').send({ ...COMPANY, oauthRegistrationToken: token }).expect(201)).body,
      );
      const session = h.parseSession(registered.session);
      const [only] = await identitiesOf(session);

      await h.http().delete(`/auth/identities/${only?.id}`).set(...h.bearer(session)).expect(409);
    });

    it('lets someone drop the password once Google is linked, and keeps the other one', async () => {
      const { session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-keep' } });
      const password = (await identitiesOf(session)).find((identity) => identity.provider === 'password');

      await h.http().delete(`/auth/identities/${password?.id}`).set(...h.bearer(session)).expect(200);

      expect((await identitiesOf(session)).map((identity) => identity.provider)).toEqual(['google']);
    });

    it('treats somebody else’s identity as nonexistent, and rejects a malformed id', async () => {
      const { session } = await adminSession();
      const other = await adminSession();
      const [theirs] = await identitiesOf(other.session);

      await h.http().delete(`/auth/identities/${theirs?.id}`).set(...h.bearer(session)).expect(404);
      await h.http().delete('/auth/identities/not-a-uuid').set(...h.bearer(session)).expect(400);
      expect(await identitiesOf(other.session)).toHaveLength(1);
    });

    it('requires a signed-in user for every identity route', async () => {
      await h.http().get('/auth/identities').expect(401);
      await h.http().delete('/auth/identities/00000000-0000-4000-8000-000000000000').expect(401);
    });

    it('audits an unlink', async () => {
      const { admin, session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-a' } });
      const google = (await identitiesOf(session)).find((identity) => identity.provider === 'google');

      await h.http().delete(`/auth/identities/${google?.id}`).set(...h.bearer(session)).expect(200);

      expect(await actionsFor(admin.companyId)).toContain('auth.identity_unlinked');
    });

    it('serialises unlinks: an unlink waits while ANOTHER of the user’s identities is being changed', async () => {
      // The race that matters is two unlinks of DIFFERENT identities, each seeing
      // "the other one remains". Deleting the locked row itself would block anyway,
      // so lock the one we are NOT deleting: only the unlink's own row lock notices.

      const { admin, session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-lock' } });
      const [first] = await identitiesOf(session);

      const holder = h.dataSource.createQueryRunner();
      await holder.connect();
      await holder.startTransaction();
      try {
        await holder.query('SELECT id FROM auth_identity WHERE "userId" = $1 AND id <> $2 FOR UPDATE', [
          admin.userId,
          first?.id,
        ]);

        let settled = false;
        const pending = h
          .http()
          .delete(`/auth/identities/${first?.id}`)
          .set(...h.bearer(session))
          .then((response) => {
            settled = true;
            return response;
          });
        await new Promise((resolve) => setTimeout(resolve, 400));
        expect(settled).toBe(false);

        await holder.rollbackTransaction();
        expect((await pending).status).toBe(200);
      } finally {
        if (holder.isTransactionActive) await holder.rollbackTransaction();
        await holder.release();
      }
    });
  });

  // ---- exchanging the code ------------------------------------------------

  describe('POST /auth/oauth/exchange', () => {
    async function freshCode(): Promise<{ code: string; userId: string }> {
      const { admin, session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-ex' } });
      return { code: codeOf(await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-ex' } })), userId: admin.userId };
    }

    it('trades the code for a working session', async () => {
      const { code, userId } = await freshCode();

      const response = await h.exchangeOAuthCode(code);

      expect(response.status).toBe(200);
      expect(await whoAmI(h.parseSession(response.body))).toBe(userId);
    });

    it('is single-use', async () => {
      const { code } = await freshCode();

      await h.exchangeOAuthCode(code);
      expect((await h.exchangeOAuthCode(code)).status).toBe(401);
    });

    it('lives 60 seconds', async () => {
      const { code } = await freshCode();
      h.clock.advance(61_000);

      expect((await h.exchangeOAuthCode(code)).status).toBe(401);
    });

    it('still works just inside its lifetime', async () => {
      const { code } = await freshCode();
      h.clock.advance(59_000);

      expect((await h.exchangeOAuthCode(code)).status).toBe(200);
    });

    it('rejects garbage and an empty body', async () => {
      expect((await h.exchangeOAuthCode('garbage')).status).toBe(401);
      await h.http().post('/auth/oauth/exchange').send({}).expect(400);
    });

    it('only works as an exchange code: it is not an activation, invite or reset token', async () => {
      const { code } = await freshCode();

      await h.http().get('/auth/activate').query({ token: code }).expect(400);
      await h.http().post('/auth/accept-invite').send({ token: code, password: DEFAULT_PASSWORD }).expect(400);
      await h.http().post('/auth/password/reset').send({ token: code, newPassword: 'another-password-1' }).expect(400);
      // …and the failed attempts did not spend it.
      expect((await h.exchangeOAuthCode(code)).status).toBe(200);
    });

    it('refuses a user disabled during the minute between callback and exchange', async () => {
      const { session, admin } = await adminSession();
      await h.subscribe(session, 'basic');
      const employee = await h.inviteAndAccept(session, admin.companyId);
      await h.googleFlow({ intent: 'link', session: employee.session, profile: { providerUserId: 'g-emp' } });
      const code = codeOf(await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-emp' } }));

      await h.http().delete(`/employees/${employee.userId}`).set(...h.bearer(session)).expect(200);

      expect((await h.exchangeOAuthCode(code)).status).toBe(401);
    });

    it('supersedes an earlier unspent code for the same user', async () => {
      const { session } = await adminSession();
      await h.googleFlow({ intent: 'link', session, profile: { providerUserId: 'g-sup' } });
      const older = codeOf(await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-sup' } }));
      const newer = codeOf(await h.googleFlow({ intent: 'login', profile: { providerUserId: 'g-sup' } }));

      expect((await h.exchangeOAuthCode(older)).status).toBe(401);
      expect((await h.exchangeOAuthCode(newer)).status).toBe(200);
    });

    it('stores only a hash of the code', async () => {
      const { code } = await freshCode();
      const stored = await h.dataSource.getRepository(AuthToken).find({ where: { type: 'oauth_exchange' } });

      expect(stored).toHaveLength(1);
      expect(stored[0]?.tokenHash).not.toBe(code);
    });
  });
});

describe('Google sign-in when it is not configured (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start({ googleConfigured: false });
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  it('answers 503 on every Google route', async () => {
    await h.http().post('/auth/oauth/google/url').send({ intent: 'login' }).expect(503);
    await h.http().get('/auth/google/callback').query({ code: 'x', state: 'y' }).expect(503);

    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.http().post('/auth/identities/google/link').set(...h.bearer(session)).expect(503);
  });

  it('leaves password auth entirely unaffected', async () => {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);

    await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
    await h.http().get('/auth/identities').set(...h.bearer(session)).expect(200);
  });
});
