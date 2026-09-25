import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';

/**
 * The counters live in process memory and use real time, so every test makes its own
 * company (its own bucket) and its own client address (`X-Forwarded-For`, with `trust proxy`
 * switched on for the run) rather than relying on a reset between tests.
 */
describe('plan-tiered rate limiting (integration)', () => {
  let h: AppHarness;
  let addressCounter = 0;

  beforeAll(async () => {
    h = await AppHarness.start({ rateLimit: true });
    h.app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }, 120_000);

  beforeEach(async () => {
    await h.reset();
    // Setup calls (register, sign in…) come from a fresh address each test.
    h.clientAddress = nextAddress();
  });
  afterAll(() => h.stop());

  const nextAddress = () => `10.9.${Math.floor(addressCounter / 250)}.${(addressCounter++ % 250) + 1}`;

  async function company(plan: 'free' | 'basic' | 'premium'): Promise<{ account: RegisteredAccount; session: SessionBody }> {
    const account = await h.registerAndActivate();
    const session = await h.login(account.email);
    if (plan !== 'free') await h.subscribe(session, plan);
    return { account, session };
  }

  /** `count` calls to a cheap authenticated route; returns every status, in order. */
  async function hit(session: SessionBody, count: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let index = 0; index < count; index += 1) {
      statuses.push((await h.http().get('/auth/me').set(...h.bearer(session))).status);
    }
    return statuses;
  }

  describe('per company, at the plan’s limit', () => {
    it('a Free company is throttled at 30 requests a minute; a Premium one is not', async () => {
      const free = await company('free');
      const premium = await company('premium');
      const limit = PLAN_CATALOG.free.rateLimitPerMinute;

      // The sign-in and plan requests above went through the strict/anonymous paths, not this bucket.
      const freeStatuses = await hit(free.session, limit + 1);
      expect(freeStatuses.slice(0, limit).every((status) => status === 200)).toBe(true);
      expect(freeStatuses[limit]).toBe(429);

      const premiumStatuses = await hit(premium.session, limit + 1);
      expect(premiumStatuses.every((status) => status === 200)).toBe(true);
    });

    it('sends the rate-limit headers, counting down', async () => {
      const { session } = await company('basic');

      const first = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(first.headers['x-ratelimit-limit']).toBe(String(PLAN_CATALOG.basic.rateLimitPerMinute));
      expect(first.headers['x-ratelimit-remaining']).toBe(String(PLAN_CATALOG.basic.rateLimitPerMinute - 1));
      expect(Number(first.headers['x-ratelimit-reset'])).toBeGreaterThan(0);
      expect(Number(first.headers['x-ratelimit-reset'])).toBeLessThanOrEqual(60);

      const second = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(second.headers['x-ratelimit-remaining']).toBe(String(PLAN_CATALOG.basic.rateLimitPerMinute - 2));
    });

    it('answers 429 naming the plan, the limit, when to retry and the way up', async () => {
      const { session } = await company('free');
      await hit(session, PLAN_CATALOG.free.rateLimitPerMinute);

      const refused = await h.http().get('/auth/me').set(...h.bearer(session)).expect(429);
      expect(refused.body.statusCode).toBe(429);
      expect(refused.body.correlationId).toBeDefined();
      expect(refused.body.message).toContain('free plan');
      expect(refused.body.message).toContain(`${PLAN_CATALOG.free.rateLimitPerMinute} requests per minute`);
      expect(refused.body.message).toContain('basic plan');
      expect(refused.body.message).toContain('PATCH /subscriptions/me');
      expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
      expect(refused.headers['x-ratelimit-remaining']).toBe('0');
      expect(refused.headers['x-ratelimit-limit']).toBe('30');
    });

    it('a Premium company has no higher plan to be pointed at', async () => {
      const { session } = await company('premium');
      await hit(session, PLAN_CATALOG.premium.rateLimitPerMinute);

      const refused = await h.http().get('/auth/me').set(...h.bearer(session)).expect(429);
      expect(refused.body.message).toContain('premium plan');
      expect(refused.body.message).not.toContain('Upgrade');
    });

    it('one budget for the whole company: another user and an API key spend the same requests', async () => {
      const { account, session } = await company('basic');
      const colleague = await h.inviteAndAccept(session, account.companyId);
      const { key } = await h.createApiKey(session, { scopes: ['files:read'] });
      const limit = PLAN_CATALOG.basic.rateLimitPerMinute;

      // Already spent: 1 (the key creation) + 1 (the invite) + accept-invite (public, not counted).
      const before = await h.http().get('/auth/me').set(...h.bearer(colleague.session)).expect(200);
      const remaining = Number(before.headers['x-ratelimit-remaining']);
      expect(remaining).toBeLessThan(limit - 1);

      // Spend the rest with the ADMIN's session, then the colleague and the key are refused too.
      await hit(session, remaining);
      await h.http().get('/auth/me').set(...h.bearer(colleague.session)).expect(429);
      await h.http().get('/files').set('Authorization', `Bearer ${key}`).expect(429);
    });

    it('another company’s traffic never counts against yours', async () => {
      const busy = await company('free');
      const quiet = await company('free');
      await hit(busy.session, PLAN_CATALOG.free.rateLimitPerMinute + 1);

      await h.http().get('/auth/me').set(...h.bearer(quiet.session)).expect(200);
    });

    it('a plan change takes effect on the very next request', async () => {
      const { session } = await company('free');
      await hit(session, PLAN_CATALOG.free.rateLimitPerMinute);
      await h.http().get('/auth/me').set(...h.bearer(session)).expect(429);

      // A company over its budget can still reach the plan route: it has a bucket of its own.
      await h.http().post('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'basic' }).expect(201);

      const after = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(after.headers['x-ratelimit-limit']).toBe(String(PLAN_CATALOG.basic.rateLimitPerMinute));
    });

    it('the plan routes keep a small budget of their own (10 a minute), separate from the plan’s general one', async () => {
      const { session } = await company('free');

      // Each is refused for a business reason (409: already chosen) — they still count.
      await h.http().post('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' }).expect(201);
      for (let index = 0; index < 9; index += 1) {
        await h.http().post('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' }).expect(409);
      }
      await h.http().post('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' }).expect(429);
      // PATCH is a different route, so a different bucket, with the same size.
      for (let index = 0; index < 10; index += 1) {
        await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' });
      }
      await h.http().patch('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'free' }).expect(429);

      // The general budget was untouched by any of it.
      const general = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(general.headers['x-ratelimit-remaining']).toBe(String(PLAN_CATALOG.free.rateLimitPerMinute - 1));
    });

    it('GraphQL spends the same company budget as REST', async () => {
      const { session } = await company('basic');
      await hit(session, PLAN_CATALOG.basic.rateLimitPerMinute);

      const response = await h
        .http()
        .post('/graphql')
        .set(...h.bearer(session))
        .send({ query: '{ usage { storage { liveFiles } } }' });
      expect(response.body.errors?.[0]?.message).toContain(`basic plan allows ${PLAN_CATALOG.basic.rateLimitPerMinute} requests per minute`);
      expect(response.body.data ?? null).toBeNull();
    });

    it('does not limit the health probe', async () => {
      const statuses: number[] = [];
      for (let index = 0; index < 130; index += 1) {
        statuses.push((await h.http().get('/health').set('X-Forwarded-For', '10.200.0.1')).status);
      }
      expect(statuses.every((status) => status !== 429)).toBe(true);
    });
  });

  describe('per address, on the public routes', () => {
    it('sign-in allows 10 attempts a minute per address, then 429s; another address is unaffected', async () => {
      const address = nextAddress();
      const attempt = (from: string) =>
        h.http().post('/auth/login').set('X-Forwarded-For', from).send({ email: 'nobody@acme.test', password: 'wrong-password-1' });

      for (let index = 0; index < 10; index += 1) expect((await attempt(address)).status).toBe(401);
      const refused = await attempt(address);
      expect(refused.status).toBe(429);
      expect(refused.body.message).toMatch(/Too many requests/);
      expect(refused.headers['retry-after']).toBeDefined();

      expect((await attempt(nextAddress())).status).toBe(401);
    });

    it('forgot-password and resend-activation allow only 5 a minute, each with its own bucket', async () => {
      const address = nextAddress();
      const forgot = () => h.http().post('/auth/password/forgot').set('X-Forwarded-For', address).send({ email: 'a@acme.test' });
      const resend = () => h.http().post('/auth/resend-activation').set('X-Forwarded-For', address).send({ email: 'a@acme.test' });

      for (let index = 0; index < 5; index += 1) expect((await forgot()).status).toBe(200);
      expect((await forgot()).status).toBe(429);
      // Spending the forgot-password budget did not touch resend-activation's.
      expect((await resend()).status).toBe(200);
    });

    it('a strict route’s bucket is separate from the general anonymous budget', async () => {
      const address = nextAddress();
      for (let index = 0; index < 11; index += 1) {
        await h.http().post('/auth/login').set('X-Forwarded-For', address).send({ email: 'x@acme.test', password: 'wrong-password-1' });
      }
      await h.http().get('/subscriptions/plans').set('X-Forwarded-For', address).expect(200);
    });

    it('takes the address from X-Forwarded-For only because a proxy is trusted', async () => {
      // With one trusted hop the LAST entry is the client as the proxy saw it; a client cannot
      // dodge the limit by prepending addresses of its own.
      const address = nextAddress();
      const attempt = (chain: string) =>
        h.http().post('/auth/login').set('X-Forwarded-For', chain).send({ email: 'nobody@acme.test', password: 'wrong-password-1' });

      for (let index = 0; index < 10; index += 1) await attempt(`1.1.1.${index}, ${address}`);
      expect((await attempt(`9.9.9.9, ${address}`)).status).toBe(429);
    });
  });
});
