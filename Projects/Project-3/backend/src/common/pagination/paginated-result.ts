/**
 * Two envelope shapes, one per pagination style — see `paginate.ts` for
 * which resources use which and why. Both live here, in `common/`, so no
 * module ever repeats Project-2's worst structural mistake: declaring
 * `PaginatedResult<T>` inside `products.service.ts` and having eight other
 * modules import a shared type from a domain module that happens to own it.
 */

export interface OffsetPage<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CursorPage<T> {
  data: T[];
  meta: {
    nextCursor: string | null;
    hasMore: boolean;
  };
}
