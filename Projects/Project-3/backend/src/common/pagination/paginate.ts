import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import { type Cursor, encodeCursor } from './cursor.js';
import type { CursorPage, OffsetPage } from './paginated-result.js';

/** Every keyset-paginated entity needs at least these two columns. */
type KeysetEntity = ObjectLiteral & { id: string; createdAt: Date };

/**
 * Orders by `(createdAt, id)` and, when a cursor is present, adds the keyset
 * predicate — the exact query shape proven against real data (including a
 * deliberate same-millisecond collision) in
 * `src/database/keyset-pagination.integration.spec.ts`. Call this before
 * `toCursorPage`, after any `.where()`/tenant scoping the caller needs. `direction`
 * is the sort order (newest-first lists pass `'DESC'`); the cursor itself is
 * direction-agnostic.
 */
export function applyCursor<Entity extends KeysetEntity>(
  qb: SelectQueryBuilder<Entity>,
  alias: string,
  cursor: Cursor | undefined,
  direction: 'ASC' | 'DESC' = 'ASC',
): SelectQueryBuilder<Entity> {
  qb.orderBy(`${alias}.createdAt`, direction).addOrderBy(`${alias}.id`, direction);

  if (cursor) {
    // The tie-break runs the same way as the sort, so one row-value comparison
    // is the whole predicate whichever way the list is read.
    const comparison = direction === 'ASC' ? '>' : '<';
    qb.andWhere(`(${alias}.createdAt, ${alias}.id) ${comparison} (:cursorCreatedAt, :cursorId)`, {
      cursorCreatedAt: cursor.createdAt,
      cursorId: cursor.id,
    });
  }

  return qb;
}

/**
 * Fetches `limit + 1` rows to learn whether another page exists without a
 * separate `COUNT` query, then trims back to `limit`. Call `applyCursor`
 * first — this does not set ordering or the predicate itself.
 */
export async function toCursorPage<Entity extends KeysetEntity>(
  qb: SelectQueryBuilder<Entity>,
  limit: number,
): Promise<CursorPage<Entity>> {
  const rows = await qb.limit(limit + 1).getMany();
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  const last = data.at(-1);

  return {
    data,
    meta: {
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    },
  };
}

export function toOffsetPage<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): OffsetPage<T> {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * The "one shared `toPaginated()`" from AGENTS.md's response-DTO convention:
 * maps a page's `data` through a DTO mapper while leaving `meta` untouched,
 * so a service can fetch entities, then hand the page straight to this
 * before returning it from a controller. Works for both page shapes, since
 * both are structurally `{ data: T[]; meta: M }`.
 */
export function mapPageData<TFrom, TTo, TMeta>(
  page: { data: TFrom[]; meta: TMeta },
  mapper: (item: TFrom) => TTo,
): { data: TTo[]; meta: TMeta } {
  return { data: page.data.map(mapper), meta: page.meta };
}
