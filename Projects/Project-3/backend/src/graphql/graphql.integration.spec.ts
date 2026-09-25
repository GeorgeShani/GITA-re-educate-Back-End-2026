import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { lexicographicSortSchema, printSchema } from 'graphql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness, type SessionBody } from '#test/support/app-harness.js';
import { DemoSeedService } from '#/demo/demo-seed.service.js';
import { MAX_QUERY_COMPLEXITY, MAX_QUERY_DEPTH } from './query-limits.js';
import { SCHEMA_FILE } from './schema-sdl.js';

const at = (iso: string) => new Date(iso);

/** Every field the schema offers, so a REST-vs-GraphQL comparison covers the whole tree. */
const FULL_USAGE = `
  range { from to days }
  filesPerDay { date files }
  byEmployee { userId fullName files bytes lastUploadAt }
  storage { liveFiles liveBytes uploadedBytesInRange }
  quota { plan limit used periodStart periodEnd points { date used pace } }
  planHistory { effectiveAt fromPlan toPlan prorationCents invoiceId invoiceTotalCents }
`;

const responseSchema = z.object({
  data: z.unknown().nullable().optional(),
  errors: z
    .array(z.object({ message: z.string(), extensions: z.record(z.string(), z.unknown()).optional() }))
    .optional(),
});

describe('GraphQL analytics (integration)', () => {
  let h: AppHarness;

  beforeAll(async () => {
    h = await AppHarness.start();
  }, 120_000);
  beforeEach(() => h.reset());
  afterAll(() => h.stop());

  async function gql(token: string | undefined, query: string, variables?: Record<string, unknown>) {
    const request = h.http().post('/graphql').send({ query, variables });
    if (token) request.set('Authorization', `Bearer ${token}`);
    const response = await request;
    return { status: response.status, ...responseSchema.parse(response.body) };
  }

  async function company(plan: 'free' | 'basic' | 'premium' = 'basic') {
    const admin = await h.registerAndActivate();
    const session = await h.login(admin.email);
    await h.subscribe(session, plan);
    return { admin, session, companyId: admin.companyId };
  }

  /** The hand-countable March fixture also used by the REST analytics spec. */
  async function march() {
    const base = await company('basic');
    const employee = await h.inviteAndAccept(base.session, base.companyId);
    await h.seedUsage(base.companyId, 2, '2026-03-01', { createdAt: at('2026-03-01T09:00:00Z'), sizeBytes: 100 });
    await h.seedUsage(base.companyId, 4, '2026-03-01', {
      createdAt: at('2026-03-03T00:00:00Z'),
      uploaderId: employee.userId,
      sizeBytes: 1000,
    });
    h.clock.set(at('2026-03-05T12:00:00Z'));
    // Tokens minted before the clock moved have expired by now: sign in again.
    return {
      ...base,
      employee: { ...employee, session: await h.login(employee.email) },
      session: await h.login(base.admin.email),
    };
  }

  const rest = async (session: SessionBody, query: Record<string, string> = {}) =>
    (await h.http().get('/analytics/usage').set(...h.bearer(session)).query(query).expect(200)).body;

  describe('the numbers', () => {
    it('are exactly the REST numbers, for the default range and for an explicit one', async () => {
      const { session } = await march();

      const byDefault = await gql(session.accessToken, `{ usage { ${FULL_USAGE} } }`);
      expect(byDefault.errors).toBeUndefined();
      expect(byDefault.data).toEqual({ usage: await rest(session) });

      const explicit = await gql(
        session.accessToken,
        `query ($from: DateTime, $to: DateTime) { usage(from: $from, to: $to) { ${FULL_USAGE} } }`,
        { from: '2026-03-02T00:00:00Z', to: '2026-03-05T00:00:00Z' },
      );
      expect(explicit.errors).toBeUndefined();
      expect(explicit.data).toEqual({ usage: await rest(session, { from: '2026-03-02', to: '2026-03-05' }) });
    });

    it('are non-trivial (so the equality above means something)', async () => {
      const { session } = await march();
      const response = await gql(session.accessToken, '{ usage { storage { liveFiles } quota { used } } }');
      expect(response.data).toEqual({ usage: { storage: { liveFiles: 6 }, quota: { used: 6 } } });
    });

    it('a query can pick just the fields it wants', async () => {
      const { session } = await march();
      const response = await gql(session.accessToken, '{ usage { byEmployee { fullName files } } }');
      expect(response.data).toMatchObject({ usage: { byEmployee: expect.any(Array) } });
      expect(JSON.stringify(response.data)).not.toContain('bytes');
    });

    it('never shows another company’s rows', async () => {
      const mine = await march();
      const other = await company('basic');

      const theirs = await gql(other.session.accessToken, '{ usage { storage { liveFiles } byEmployee { userId } } }');
      expect(theirs.data).toEqual({ usage: { storage: { liveFiles: 0 }, byEmployee: [] } });
      expect(JSON.stringify(theirs.data)).not.toContain(mine.admin.userId);
    });
  });

  describe('who may ask', () => {
    it('no token: refused, and no data', async () => {
      const response = await gql(undefined, '{ usage { storage { liveFiles } } }');
      expect(response.errors?.[0]?.message).toBe('Missing bearer token');
      expect(response.data ?? null).toBeNull();
    });

    it('a garbage token: refused', async () => {
      const response = await gql('not-a-token', '{ usage { storage { liveFiles } } }');
      expect(response.errors?.[0]?.message).toMatch(/Invalid or expired/);
    });

    it('an employee: forbidden', async () => {
      const { employee } = await march();
      const response = await gql(employee.session.accessToken, '{ usage { storage { liveFiles } } }');
      expect(response.errors?.[0]?.message).toMatch(/Forbidden/i);
      expect(response.data ?? null).toBeNull();
    });

    it('an API key — even an admin’s, with every scope — is forbidden', async () => {
      const { session } = await march();
      const { key } = await h.createApiKey(session, { scopes: ['files:read', 'files:write', 'billing:read'] });

      const response = await gql(key, '{ usage { storage { liveFiles } } }');
      expect(response.errors?.[0]?.message).toMatch(/API keys cannot be used/);
      expect(response.data ?? null).toBeNull();
    });

    it('a company with no plan is told to pick one, as over REST', async () => {
      const admin = await h.registerAndActivate();
      const session = await h.login(admin.email);
      const response = await gql(session.accessToken, '{ usage { storage { liveFiles } } }');
      expect(response.errors?.[0]?.message).toMatch(/No plan selected/);
    });

    it('a disabled person’s still-valid token is refused at once (the user is re-read, as over REST)', async () => {
      const { session, admin } = await march();
      await h.dataSource.query(`UPDATE "user" SET status = 'disabled' WHERE id = $1`, [admin.userId]);
      const response = await gql(session.accessToken, '{ usage { storage { liveFiles } } }');
      expect(response.errors?.[0]?.message).toMatch(/Invalid or expired/);
    });

    it('the read-only demo can query (a POST that only reads)', async () => {
      await h.app.get(DemoSeedService).seed();
      const demo = h.parseSession((await h.http().post('/auth/demo').expect(200)).body);
      const response = await gql(demo.accessToken, '{ usage { storage { liveFiles } } }');
      expect(response.errors).toBeUndefined();
      expect(response.data).toEqual({ usage: { storage: { liveFiles: 6 } } });
    });
  });

  describe('limits', () => {
    it('rejects a query nested past the depth limit, naming both numbers, before running anything', async () => {
      const { session } = await march();
      const response = await gql(session.accessToken, '{ __schema { types { fields { type { ofType { ofType { name } } } } } } }');
      expect(response.errors?.[0]?.message).toContain(`nested 7 levels deep; the most allowed is ${MAX_QUERY_DEPTH}`);
      expect(response.errors?.[0]?.extensions).toMatchObject({ depth: 7, maximum: MAX_QUERY_DEPTH });
      expect(response.data ?? null).toBeNull();
    });

    it('counts depth through fragments too', async () => {
      const { session } = await march();
      const response = await gql(
        session.accessToken,
        `query { usage { ...Q } }
         fragment Q on UsageAnalytics { quota { ...P } }
         fragment P on QuotaBurnDown { points { ...D } }
         fragment D on BurnDownPoint { date used pace }
         `,
      );
      // usage > quota > points > date = 4 deep: allowed.
      expect(response.errors).toBeUndefined();

      const tooDeep = await gql(session.accessToken, '{ __type(name: "Query") { fields { type { ofType { ofType { fields { name } } } } } } }');
      expect(tooDeep.errors?.[0]?.extensions).toMatchObject({ maximum: MAX_QUERY_DEPTH });
    });

    it('prices a query, and rejects one that costs more than the cap — including by repeating a field with aliases', async () => {
      const { session } = await march();
      const one = await gql(session.accessToken, `{ a: usage { ${FULL_USAGE} } }`);
      expect(one.errors).toBeUndefined();

      const repeated = (times: number) =>
        `{ ${Array.from({ length: times }, (_, index) => `a${index}: usage { ${FULL_USAGE} }`).join('\n')} }`;
      // The whole tree costs 228 (root 50 + 178 for what it selects): four fit under the cap, five do not.
      expect((await gql(session.accessToken, repeated(4))).errors).toBeUndefined();

      const response = await gql(session.accessToken, repeated(5));
      const error = response.errors?.[0];
      expect(error?.message).toMatch(new RegExp(`the most allowed is ${MAX_QUERY_COMPLEXITY}`));
      expect(error?.extensions).toMatchObject({ maximum: MAX_QUERY_COMPLEXITY });
      expect(error?.extensions?.cost).toBeGreaterThan(MAX_QUERY_COMPLEXITY);
      expect(response.data ?? null).toBeNull();
    });

    it('a cheap query on the same field is fine many times over', async () => {
      const { session } = await march();
      const aliases = Array.from({ length: 6 }, (_, index) => `a${index}: usage { storage { liveFiles } }`).join('\n');
      const response = await gql(session.accessToken, `{ ${aliases} }`);
      expect(response.errors).toBeUndefined();
    });
  });

  describe('the schema', () => {
    it('has no mutations and no subscriptions, so nothing can be changed through it', async () => {
      const { session } = await march();
      const introspected = await gql(session.accessToken, '{ __schema { mutationType { name } subscriptionType { name } queryType { name } } }');
      expect(introspected.data).toEqual({
        __schema: { mutationType: null, subscriptionType: null, queryType: { name: 'Query' } },
      });

      const attempt = await gql(session.accessToken, 'mutation { usage { storage { liveFiles } } }');
      expect(attempt.errors?.[0]?.message).toMatch(/not configured to execute mutation/);
    });

    it('is the committed schema.gql (regenerate with `npm run graphql:schema`)', async () => {
      const live = printSchema(lexicographicSortSchema(h.app.get(GraphQLSchemaHost).schema));
      const committed = await readFile(resolve(SCHEMA_FILE), 'utf8');
      expect(committed).toBe(`${live}\n`);
    });
  });
});
