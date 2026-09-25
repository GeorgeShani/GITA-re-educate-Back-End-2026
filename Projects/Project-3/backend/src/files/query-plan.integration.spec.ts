import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHarness } from '#test/support/app-harness.js';
import { applyCursor } from '#/common/pagination/paginate.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { FileAsset } from './file-asset.entity.js';
import { applyFileVisibility, type FileViewer } from './file-visibility.js';

/** Every node of a Postgres `EXPLAIN (FORMAT JSON)` plan, however deeply nested. */
const planNode: z.ZodType<PlanNode> = z.lazy(() =>
  z.object({
    'Node Type': z.string(),
    'Index Name': z.string().optional(),
    'Relation Name': z.string().optional(),
    Plans: z.array(planNode).optional(),
  }),
);
interface PlanNode {
  'Node Type': string;
  'Index Name'?: string | undefined;
  'Relation Name'?: string | undefined;
  Plans?: PlanNode[] | undefined;
}
const explainRows = z.array(z.object({ 'QUERY PLAN': z.array(z.object({ Plan: planNode })) }));

function flatten(node: PlanNode): PlanNode[] {
  return [node, ...(node.Plans ?? []).flatMap(flatten)];
}

const COMPANIES = 12;
const FILES_PER_COMPANY = 2_500;

/**
 * SCOPE's verification step 16: the tenant-scoped file-list query reads an INDEX, not the whole table —
 * "the indexing plan proven real, not aspirational".
 *
 * Both halves matter. The table is filled with other tenants' rows (so a sequential scan would be the
 * wrong answer and the planner knows it), and `ANALYZE` gives the planner real statistics, so the plan
 * is what production would choose rather than what an empty table's defaults suggest. Nothing is
 * forced with `enable_seqscan = off`: the planner picks the index on its own merits.
 *
 * Run against Neon by pointing DATABASE_URL at a branch; the assertion is the same.
 */
describe('query plans (integration)', () => {
  let h: AppHarness;
  let companyId: string;
  let adminId: string;

  beforeAll(async () => {
    h = await AppHarness.start();
    await h.reset();

    const companies: Array<{ companyId: string; userId: string }> = [];
    for (let index = 0; index < COMPANIES; index += 1) {
      const admin = await h.registerAndActivate();
      companies.push({ companyId: admin.companyId, userId: admin.userId });
    }
    for (const company of companies) {
      await h.dataSource.query(
        `INSERT INTO file_asset (id, "companyId", "uploaderId", "originalName", "mimeType", "sizeBytes", "storageKey", visibility, "createdAt", "updatedAt")
         SELECT gen_random_uuid(), $1, $2, 'file-' || n || '.csv', 'text/csv', 100, 'seeded/' || gen_random_uuid(), 'company',
                now() - (n || ' minutes')::interval, now()
         FROM generate_series(1, $3) AS n`,
        [company.companyId, company.userId, FILES_PER_COMPANY],
      );
    }
    // A slice of soft-deleted rows too: they are what the partial index exists to keep out of the hot path.
    await h.dataSource.query(`UPDATE file_asset SET "deletedAt" = now() WHERE random() < 0.15`);
    await h.dataSource.query('ANALYZE file_asset');

    ({ companyId, userId: adminId } = companies[0] ?? { companyId: '', userId: '' });
  }, 300_000);
  afterAll(() => h.stop());

  /** The list query exactly as `FilesService.list` builds it, run through EXPLAIN. */
  async function planFor(viewer: FileViewer, cursor: { createdAt: Date; id: string } | undefined) {
    const repository = h.dataSource.getRepository(FileAsset);
    const qb = applyFileVisibility(h.app.get(TenantScope).forCompany(repository, companyId, 'f'), 'f', viewer);
    applyCursor(qb, 'f', cursor, 'DESC').take(21);
    const [sql, parameters] = qb.getQueryAndParameters();

    const rows = explainRows.parse(await h.dataSource.query(`EXPLAIN (FORMAT JSON) ${sql}`, parameters));
    const root = rows[0]?.['QUERY PLAN'][0]?.Plan;
    if (!root) throw new Error('EXPLAIN returned no plan');
    return flatten(root).filter((node) => node['Relation Name'] === 'file_asset');
  }

  const TENANT_INDEXES = ['idx_file_asset_company', 'idx_file_asset_company_live'];

  it('the admin’s first page reads the PARTIAL live-files index — the one built for exactly this query — never the table', async () => {
    const nodes = await planFor({ userId: adminId, role: 'admin' }, undefined);

    expect(nodes.map((node) => node['Node Type'])).not.toContain('Seq Scan');
    expect(nodes.map((node) => node['Node Type']).join(' ')).toMatch(/Index/);
    // The planner prefers the partial index (companyId, createdAt WHERE deletedAt IS NULL) over the
    // full one for this predicate, because it is smaller and already ordered the way the page is.
    expect(nodes.map((node) => node['Index Name'])).toEqual(['idx_file_asset_company_live']);
  });

  it('the FULL tenant index is the one used when deleted rows are in play (the partial one cannot serve those)', async () => {
    const repository = h.dataSource.getRepository(FileAsset);
    const qb = h
      .app.get(TenantScope)
      .forCompany(repository, companyId, 'f')
      .andWhere('f."deletedAt" IS NOT NULL')
      .orderBy('f.createdAt', 'DESC')
      .take(21);
    const [sql, parameters] = qb.getQueryAndParameters();
    const rows = explainRows.parse(await h.dataSource.query(`EXPLAIN (FORMAT JSON) ${sql}`, parameters));
    const root = rows[0]?.['QUERY PLAN'][0]?.Plan;
    // Deleted rows are a minority, so Postgres may gather them with a bitmap scan; the index is on a child node.
    const nodes = root ? flatten(root) : [];

    expect(nodes.map((node) => node['Node Type'])).not.toContain('Seq Scan');
    expect(nodes.map((node) => node['Index Name'])).toContain('idx_file_asset_company');
  });

  it('a later page (a keyset cursor) reads the same index — cost does not grow with depth', async () => {
    const cursor = { createdAt: new Date(Date.now() - 1_000 * 60 * 1_200), id: '00000000-0000-4000-8000-000000000000' };
    const nodes = await planFor({ userId: adminId, role: 'admin' }, cursor);

    expect(nodes.map((node) => node['Node Type'])).not.toContain('Seq Scan');
    for (const node of nodes) expect(TENANT_INDEXES).toContain(node['Index Name']);
  });

  it('an employee’s page (visibility rule and all) also starts from a tenant index', async () => {
    const employee = await h.dataSource.query(`SELECT id FROM "user" WHERE "companyId" = $1 LIMIT 1`, [companyId]);
    const nodes = await planFor({ userId: employee[0].id, role: 'employee' }, undefined);

    expect(nodes.map((node) => node['Node Type'])).not.toContain('Seq Scan');
    for (const node of nodes) expect(TENANT_INDEXES).toContain(node['Index Name']);
  });

  it('control: without a tenant filter the same table WOULD be scanned — so the assertions above can fail', async () => {
    const rows = explainRows.parse(
      await h.dataSource.query(`EXPLAIN (FORMAT JSON) SELECT * FROM file_asset WHERE "sizeBytes" = 100`),
    );
    const root = rows[0]?.['QUERY PLAN'][0]?.Plan;
    const types = root ? flatten(root).map((node) => node['Node Type']) : [];
    expect(types).toContain('Seq Scan');
  });
});
