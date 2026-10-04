import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppHarness, type RegisteredAccount, type SessionBody } from '#test/support/app-harness.js';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';
import { SESSION_LIMIT_PER_MINUTE } from './plan-throttler.guard.js';

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

  /** The credential a program uses: it spends the company's PLAN budget (a session does not; see below). */
  async function keyFor(session: SessionBody): Promise<string> {
    return (await h.createApiKey(session, { scopes: ['files:read'] })).key;
  }

  /** `count` calls with an API key to a cheap route; returns every status, in order (any answer but 429 is "not throttled"). */
  async function hit(key: string, count: number): Promise<number[]> {
    const statuses: number[] = [];
    for (let index = 0; index < count; index += 1) {
      statuses.push((await h.http().get('/subscriptions/me').set('Authorization', `Bearer ${key}`)).status);
    }
    return statuses;
  }
  const call = (key: string) => h.http().get('/subscriptions/me').set('Authorization', `Bearer ${key}`);

  describe('asking a file a question', () => {
    it('has a small budget of its own: the eleventh question in a minute is refused, while the rest of the API still answers', async () => {
      const { session } = await company('premium');
      const key = (await h.createApiKey(session, { scopes: ['files:read'] })).key;
      const ask = () => h.http().post('/files/00000000-0000-4000-8000-000000000000/ask').set('Authorization', `Bearer ${key}`).send({ question: 'How many rows?' });

      const statuses: number[] = [];
      for (let index = 0; index < 11; index += 1) statuses.push((await ask()).status);
      expect(statuses.slice(0, 10).every((status) => status !== 429)).toBe(true);
      expect(statuses[10]).toBe(429);
      expect((await call(key)).status).not.toBe(429);
    });
  });

  describe('API keys: per company, at the plan’s limit', () => {
    it('a Free company is throttled at 30 requests a minute; a Premium one is not', async () => {
      const free = await keyFor((await company('free')).session);
      const premium = await keyFor((await company('premium')).session);
      const limit = PLAN_CATALOG.free.rateLimitPerMinute;

      const freeStatuses = await hit(free, limit + 1);
      expect(freeStatuses.slice(0, limit).every((status) => status !== 429)).toBe(true);
      expect(freeStatuses[limit]).toBe(429);

      const premiumStatuses = await hit(premium, limit + 1);
      expect(premiumStatuses.every((status) => status !== 429)).toBe(true);
    });

    it('sends the rate-limit headers, counting down', async () => {
      const key = await keyFor((await company('basic')).session);

      const first = await call(key);
      expect(first.headers['x-ratelimit-limit']).toBe(String(PLAN_CATALOG.basic.rateLimitPerMinute));
      expect(first.headers['x-ratelimit-remaining']).toBe(String(PLAN_CATALOG.basic.rateLimitPerMinute - 1));
      expect(Number(first.headers['x-ratelimit-reset'])).toBeGreaterThan(0);
      expect(Number(first.headers['x-ratelimit-reset'])).toBeLessThanOrEqual(60);

      const second = await call(key);
      expect(second.headers['x-ratelimit-remaining']).toBe(String(PLAN_CATALOG.basic.rateLimitPerMinute - 2));
    });

    it('answers 429 naming the plan, the limit, when to retry and the way up', async () => {
      const key = await keyFor((await company('free')).session);
      await hit(key, PLAN_CATALOG.free.rateLimitPerMinute);

      const refused = await call(key).expect(429);
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
      const key = await keyFor((await company('premium')).session);
      await hit(key, PLAN_CATALOG.premium.rateLimitPerMinute);

      const refused = await call(key).expect(429);
      expect(refused.body.message).toContain('premium plan');
      expect(refused.body.message).not.toContain('Upgrade');
    });

    it('one budget for the whole company: two keys, even a colleague’s, spend the same requests', async () => {
      const { account, session } = await company('basic');
      const colleague = await h.inviteAndAccept(session, account.companyId);
      const adminKey = await keyFor(session);
      const colleagueKey = await keyFor(colleague.session);
      const limit = PLAN_CATALOG.basic.rateLimitPerMinute;

      const before = await call(colleagueKey);
      expect(Number(before.headers['x-ratelimit-remaining'])).toBe(limit - 1);

      // Spend the rest with the ADMIN's key, and the colleague's is refused too.
      await hit(adminKey, limit - 1);
      await call(colleagueKey).expect(429);
    });

    it('another company’s traffic never counts against yours', async () => {
      const busy = await keyFor((await company('free')).session);
      const quiet = await keyFor((await company('free')).session);
      await hit(busy, PLAN_CATALOG.free.rateLimitPerMinute + 1);

      expect((await call(quiet)).status).not.toBe(429);
    });

    it('a plan change takes effect on the very next request', async () => {
      const { session } = await company('free');
      const key = await keyFor(session);
      await hit(key, PLAN_CATALOG.free.rateLimitPerMinute);
      await call(key).expect(429);

      // A company over its budget can still reach the plan route: it has a bucket of its own.
      await h.http().post('/subscriptions/me').set(...h.bearer(session)).send({ plan: 'basic' }).expect(201);

      const after = await call(key);
      expect(after.status).not.toBe(429);
      expect(after.headers['x-ratelimit-limit']).toBe(String(PLAN_CATALOG.basic.rateLimitPerMinute));
    });

    it('GraphQL spends the same company budget as REST', async () => {
      const key = await keyFor((await company('basic')).session);
      await hit(key, PLAN_CATALOG.basic.rateLimitPerMinute);

      const response = await h
        .http()
        .post('/graphql')
        .set('Authorization', `Bearer ${key}`)
        .send({ query: '{ usage { storage { liveFiles } } }' });
      expect(response.body.errors?.[0]?.message).toContain(`basic plan allows ${PLAN_CATALOG.basic.rateLimitPerMinute} requests per minute`);
      expect(response.body.data ?? null).toBeNull();
    });
  });

  describe('sessions: per person, apart from the plan', () => {
    it('a person clicking around does not spend the plan budget: a Free session passes 30 requests, an API key still has all 30', async () => {
      const { session } = await company('free');
      const key = await keyFor(session);
      const limit = PLAN_CATALOG.free.rateLimitPerMinute;

      for (let index = 0; index < limit + 5; index += 1) {
        await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      }

      const first = await call(key);
      expect(first.headers['x-ratelimit-remaining']).toBe(String(limit - 1));
    });

    it('is counted per person, at SESSION_LIMIT_PER_MINUTE, with the same headers', async () => {
      const { account, session } = await company('basic');
      const colleague = await h.inviteAndAccept(session, account.companyId);

      const first = await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      expect(first.headers['x-ratelimit-limit']).toBe(String(SESSION_LIMIT_PER_MINUTE));

      // Setting up (subscribing, inviting) already spent some of this person's budget: spend exactly what is left.
      const remaining = Number(first.headers['x-ratelimit-remaining']);
      for (let index = 0; index < remaining; index += 1) {
        await h.http().get('/auth/me').set(...h.bearer(session)).expect(200);
      }
      const refused = await h.http().get('/auth/me').set(...h.bearer(session)).expect(429);
      expect(refused.body.message).toMatch(/Too many requests/);
      expect(refused.headers['x-ratelimit-remaining']).toBe('0');

      // A colleague is a different person, so a different bucket.
      await h.http().get('/auth/me').set(...h.bearer(colleague.session)).expect(200);
    });

    it('the plan routes keep a small budget of their own (10 a minute), separate from the general one', async () => {
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
      expect(general.headers['x-ratelimit-remaining']).toBe(String(SESSION_LIMIT_PER_MINUTE - 1));
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
