import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresTestContext } from '../../test/support/postgres-context.js';

interface IndexRow {
  tablename: string;
  indexname: string;
  indexdef: string;
}

/**
 * Makes the index checklist in `AGENTS.md` provable rather than aspirational.
 * Every `[x]` entry there has exactly one assertion here; a migration that
 * silently drops an index fails this, not a code review months later.
 *
 * Reads the *live* schema via `pg_indexes` rather than parsing the migration
 * file, so it proves what actually got applied to the database.
 */
describe('database indexes', () => {
  let ctx: PostgresTestContext;
  let indexes: IndexRow[];

  beforeAll(async () => {
    ctx = await PostgresTestContext.start();
    indexes = await ctx.dataSource.query(
      `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    );
  }, 30_000);

  afterAll(() => ctx.stop());

  function find(table: string, ...columns: string[]): IndexRow | undefined {
    return indexes.find(
      (index) =>
        index.tablename === table &&
        columns.every((column) => index.indexdef.includes(column)),
    );
  }

  it('uniquely indexes company.billingEmail', () => {
    const index = find('company', 'billingEmail');
    expect(index).toBeDefined();
    expect(index?.indexdef).toMatch(/UNIQUE/);
  });

  it('uniquely indexes user on (companyId, email), leading with companyId', () => {
    const index = find('user', 'companyId', 'email');
    expect(index).toBeDefined();
    if (!index) return;

    expect(index.indexdef).toMatch(/UNIQUE/);
    // "leading with companyId" is the point — every tenant-scoped query
    // filters by companyId alone, and a composite index only serves that
    // query pattern efficiently when companyId is the leftmost column.
    const companyIdPosition = index.indexdef.indexOf('companyId');
    const emailPosition = index.indexdef.indexOf('email');
    expect(companyIdPosition).toBeGreaterThanOrEqual(0);
    expect(companyIdPosition).toBeLessThan(emailPosition);
  });

  it('uniquely indexes auth_identity on (provider, providerUserId)', () => {
    const index = find('auth_identity', 'provider', 'providerUserId');
    expect(index).toBeDefined();
    expect(index?.indexdef).toMatch(/UNIQUE/);
  });

  it('indexes userId for lookup on every child-of-User table', () => {
    expect(find('auth_identity', 'userId')).toBeDefined();
    expect(find('auth_token', 'userId')).toBeDefined();
    expect(find('refresh_token', 'userId')).toBeDefined();
  });

  it('uniquely indexes tokenHash on auth_token and refresh_token', () => {
    const authToken = find('auth_token', 'tokenHash');
    const refreshToken = find('refresh_token', 'tokenHash');

    expect(authToken?.indexdef).toMatch(/UNIQUE/);
    expect(refreshToken?.indexdef).toMatch(/UNIQUE/);
  });
});
