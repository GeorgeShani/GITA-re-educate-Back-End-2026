import type { Repository } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCompany } from '#test/support/factories.js';
import { PostgresTestContext } from '#test/support/postgres-context.js';
import { Company } from './entities/company.entity.js';
import { User } from './entities/user.entity.js';

/**
 * Proves the keyset `(createdAt, id)` pagination technique against real
 * Postgres data, ahead of Phase 3 building the reusable cursor codec and
 * `ParseSortPipe` around it. Phase 3's kit will wrap exactly this query
 * shape; this is what proves the shape itself is sound before code is built
 * on top of it.
 *
 * The thing actually under test: a cursor keyed on `createdAt` ALONE breaks
 * the instant two rows share a timestamp — the query can't tell them apart,
 * so a row gets skipped or repeated across a page boundary. This seeds 11 of
 * 12 rows on the exact same millisecond to force that collision, and proves
 * the `id` tie-break is what saves it. No dedicated index is added for this —
 * `User` is bounded by seat caps (SCOPE.md), so a sequential scan over a
 * company's rows is fine at this table's scale; large tables (`files`,
 * `audit`) get the real composite index when they're built.
 */
describe('keyset pagination over (createdAt, id)', () => {
  let ctx: PostgresTestContext;
  let companyRepo: Repository<Company>;
  let userRepo: Repository<User>;

  beforeAll(async () => {
    ctx = await PostgresTestContext.start();
    companyRepo = ctx.dataSource.getRepository(Company);
    userRepo = ctx.dataSource.getRepository(User);
  }, 30_000);

  beforeEach(() => ctx.reset());
  afterAll(() => ctx.stop());

  it('walks every row exactly once, including a same-millisecond collision', async () => {
    const company = await seedCompany(companyRepo);

    const collisionInstant = new Date('2026-01-01T00:00:00.000Z');
    const seeded: User[] = [];
    for (let i = 0; i < 12; i += 1) {
      const user = userRepo.create({
        companyId: company.id,
        email: `user-${i}@collision.test`,
        fullName: `User ${i}`,
        role: 'employee',
        status: 'active',
        createdAt: i < 11 ? collisionInstant : new Date('2026-01-02T00:00:00.000Z'),
      });
      seeded.push(await userRepo.save(user));
    }

    const pageSize = 4;
    const seenIds = new Set<string>();
    let cursor: { createdAt: Date; id: string } | undefined;
    let pageCount = 0;

    for (let guard = 0; guard < 20; guard += 1) {
      const query = userRepo
        .createQueryBuilder('u')
        .where('u.companyId = :companyId', { companyId: company.id })
        .orderBy('u.createdAt', 'ASC')
        .addOrderBy('u.id', 'ASC')
        .limit(pageSize);

      if (cursor) {
        // Postgres row-value comparison: this is exactly the predicate the
        // codec in Phase 3 will generate from a decoded cursor.
        query.andWhere('(u.createdAt, u.id) > (:cursorCreatedAt, :cursorId)', {
          cursorCreatedAt: cursor.createdAt,
          cursorId: cursor.id,
        });
      }

      const page = await query.getMany();
      if (page.length === 0) break;
      pageCount += 1;

      for (const row of page) {
        expect(seenIds.has(row.id), `row ${row.id} returned more than once`).toBe(
          false,
        );
        seenIds.add(row.id);
      }

      const last = page.at(-1);
      if (!last) break;
      cursor = { createdAt: last.createdAt, id: last.id };
    }

    // 12 rows at 4/page: at least 3 pages proves the loop actually paginated
    // rather than returning everything in one shot.
    expect(pageCount).toBeGreaterThanOrEqual(3);
    expect(seenIds.size).toBe(seeded.length);
    for (const user of seeded) {
      expect(seenIds.has(user.id), `row ${user.id} was never returned`).toBe(true);
    }
  });

  it('two collided rows keep a stable relative order across separate queries', async () => {
    const company = await seedCompany(companyRepo);
    const sameInstant = new Date('2026-03-01T00:00:00.000Z');

    const first = await userRepo.save(
      userRepo.create({
        companyId: company.id,
        email: 'first@collision.test',
        fullName: 'First',
        role: 'employee',
        status: 'active',
        createdAt: sameInstant,
      }),
    );
    const second = await userRepo.save(
      userRepo.create({
        companyId: company.id,
        email: 'second@collision.test',
        fullName: 'Second',
        role: 'employee',
        status: 'active',
        createdAt: sameInstant,
      }),
    );

    const orderedIds = [first.id, second.id].sort();

    const run = () =>
      userRepo
        .createQueryBuilder('u')
        .where('u.companyId = :companyId', { companyId: company.id })
        .orderBy('u.createdAt', 'ASC')
        .addOrderBy('u.id', 'ASC')
        .getMany();

    const runA = await run();
    const runB = await run();

    expect(runA.map((u) => u.id)).toEqual(orderedIds);
    expect(runB.map((u) => u.id)).toEqual(orderedIds);
  });
});
