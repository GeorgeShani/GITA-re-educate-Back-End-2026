import type { Repository } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { seedCompany } from '#test/support/factories.js';
import { PostgresTestContext } from '#test/support/postgres-context.js';
import { decodeCursor } from './cursor.js';
import { applyCursor, toCursorPage } from './paginate.js';

/**
 * `src/database/keyset-pagination.integration.spec.ts` (Phase 2) proved the
 * raw `(createdAt, id)` query TECHNIQUE against real data. This proves the
 * reusable HELPERS every future module actually calls — `applyCursor` +
 * `toCursorPage` + the cursor codec, wired together — produce a correct
 * `CursorPage<T>` envelope: right `hasMore`, a `nextCursor` that actually
 * decodes back to the last row, and no duplicates/gaps walking the whole set.
 */
describe('applyCursor + toCursorPage (integration)', () => {
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

  it('walks 50 rows, including a same-millisecond collision, with no duplicates or gaps', async () => {
    const company = await seedCompany(companyRepo);
    const collisionInstant = new Date('2026-02-01T00:00:00.000Z');

    const seeded: User[] = [];
    for (let i = 0; i < 50; i += 1) {
      const user = userRepo.create({
        companyId: company.id,
        email: `user-${i}@paginate.test`,
        fullName: `User ${i}`,
        role: 'employee',
        status: 'active',
        // 40 of 50 share one instant, forcing the id tie-break to do real work.
        createdAt: i < 40 ? collisionInstant : new Date('2026-02-02T00:00:00.000Z'),
      });
      seeded.push(await userRepo.save(user));
    }

    const seenIds = new Set<string>();
    let cursor: { createdAt: Date; id: string } | undefined;
    let pageCount = 0;

    for (let guard = 0; guard < 20; guard += 1) {
      const qb = applyCursor(
        userRepo.createQueryBuilder('u').where('u.companyId = :companyId', {
          companyId: company.id,
        }),
        'u',
        cursor,
      );

      const page = await toCursorPage(qb, 7);
      pageCount += 1;

      for (const row of page.data) {
        expect(seenIds.has(row.id), `row ${row.id} returned twice`).toBe(false);
        seenIds.add(row.id);
      }

      if (!page.meta.hasMore) {
        expect(page.meta.nextCursor).toBeNull();
        break;
      }

      expect(page.meta.nextCursor).not.toBeNull();
      // The published cursor must actually decode back to the last row
      // returned — the contract a real client depends on.
      const last = page.data.at(-1);
      expect(last).toBeDefined();
      if (page.meta.nextCursor && last) {
        const decoded = decodeCursor(page.meta.nextCursor);
        expect(decoded.id).toBe(last.id);
        cursor = decoded;
      }
    }

    expect(pageCount).toBeGreaterThan(1);
    expect(seenIds.size).toBe(seeded.length);
    for (const user of seeded) {
      expect(seenIds.has(user.id), `row ${user.id} never returned`).toBe(true);
    }
  });

  it('reports hasMore: false and nextCursor: null on the final page', async () => {
    const company = await seedCompany(companyRepo);
    await userRepo.save(
      userRepo.create({
        companyId: company.id,
        email: 'solo@paginate.test',
        fullName: 'Solo',
        role: 'employee',
        status: 'active',
      }),
    );

    const qb = applyCursor(
      userRepo.createQueryBuilder('u').where('u.companyId = :companyId', {
        companyId: company.id,
      }),
      'u',
      undefined,
    );
    const page = await toCursorPage(qb, 20);

    expect(page.data).toHaveLength(1);
    expect(page.meta.hasMore).toBe(false);
    expect(page.meta.nextCursor).toBeNull();
  });
});
