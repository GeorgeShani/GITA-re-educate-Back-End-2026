import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresTestContext } from '#test/support/postgres-context.js';

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

  it('makes a password login email globally unique, case-insensitively, for password identities only', () => {
    const index = indexes.find((row) => row.indexname === 'uq_auth_identity_password_email');
    expect(index).toBeDefined();
    if (!index) return;

    expect(index.tablename).toBe('auth_identity');
    expect(index.indexdef).toMatch(/UNIQUE/);
    // The expression and the predicate are the whole point: `lower(email)` makes
    // it case-insensitive, and `WHERE provider = 'password'` leaves Google
    // identities (whose email is whatever Google reports) unconstrained.
    expect(index.indexdef).toMatch(/lower\(email\)/);
    expect(index.indexdef).toMatch(/WHERE.*provider.*password/);
  });

  it('indexes refresh_token.familyId, which family revocation updates by', () => {
    expect(find('refresh_token', 'familyId')).toBeDefined();
  });

  it('indexes userId for lookup on every child-of-User table', () => {
    expect(find('auth_identity', 'userId')).toBeDefined();
    expect(find('auth_token', 'userId')).toBeDefined();
    expect(find('refresh_token', 'userId')).toBeDefined();
  });

  it('allows one subscription per company, enforced by a unique index leading with companyId', () => {
    const index = find('subscription', 'companyId');
    expect(index).toBeDefined();
    expect(index?.indexdef).toMatch(/UNIQUE/);
  });

  it('indexes subscription_change on (companyId, effectiveAt) for plan history', () => {
    const index = indexes.find((row) => row.indexname === 'idx_subscription_change_company_effective');
    expect(index?.indexdef).toMatch(/\("companyId", "effectiveAt"\)/);
  });

  it('makes an invoice unique per (companyId, periodStart), which is what makes rollover idempotent', () => {
    const index = find('invoice', 'companyId', 'periodStart');
    expect(index).toBeDefined();
    expect(index?.indexdef).toMatch(/UNIQUE/);
    expect(index?.indexdef.indexOf('companyId')).toBeLessThan(index?.indexdef.indexOf('periodStart') ?? 0);
  });

  it('deliberately does not index invoice.lineItems', () => {
    const lineItemIndexes = indexes.filter(
      (index) => index.tablename === 'invoice' && index.indexdef.includes('lineItems'),
    );
    expect(lineItemIndexes).toEqual([]);
  });

  it('indexes usage_event on (companyId, periodKey) — the quota check and rollup hot path', () => {
    const index = indexes.find((row) => row.indexname === 'idx_usage_event_company_period');
    expect(index?.tablename).toBe('usage_event');
    expect(index?.indexdef).toMatch(/\("companyId", "periodKey"\)/);
  });

  it('indexes seat_interval on (companyId, activeFrom) and userId', () => {
    const overlap = indexes.find((row) => row.indexname === 'idx_seat_interval_company_from');
    expect(overlap?.indexdef).toMatch(/\("companyId", "activeFrom"\)/);
    expect(find('seat_interval', 'userId')).toBeDefined();
  });

  it('indexes audit_log_entry on (companyId, createdAt DESC, id) for keyset paging', () => {
    const index = find('audit_log_entry', 'companyId', 'createdAt', 'id');
    expect(index).toBeDefined();
    if (!index) return;

    expect(index.indexname).toBe('idx_audit_log_company_created');
    // Order of columns and the DESC on createdAt are the whole point: `GET
    // /audit` is newest-first, keyset-paginated within one tenant.
    expect(index.indexdef).toMatch(/\("companyId", "createdAt" DESC, id\)/);
  });

  it('indexes background_task on (status, runAfter) for the claim query', () => {
    expect(find('background_task', 'status', 'runAfter')).toBeDefined();
  });

  it('deliberately does not index background_task.payload', () => {
    const payloadIndexes = indexes.filter(
      (index) => index.tablename === 'background_task' && index.indexdef.includes('payload'),
    );
    expect(payloadIndexes).toEqual([]);
  });

  it('uniquely indexes tokenHash on auth_token and refresh_token', () => {
    const authToken = find('auth_token', 'tokenHash');
    const refreshToken = find('refresh_token', 'tokenHash');

    expect(authToken?.indexdef).toMatch(/UNIQUE/);
    expect(refreshToken?.indexdef).toMatch(/UNIQUE/);
  });
});
