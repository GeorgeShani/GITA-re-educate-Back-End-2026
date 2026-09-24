import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { UserRole } from '#/database/entities/user.entity.js';

export interface FileViewer {
  userId: string;
  role: UserRole;
}

/**
 * THE file-access rule. Stated once, here, and used by every read of `file_asset` —
 * list, detail, download, update, delete, and (Phase 8) the report and preview — so
 * "who can see this file" has exactly one implementation and one place to be wrong.
 *
 * ```
 * companyId = ctx.companyId                   -- TenantScope, applied first by the caller
 * AND deletedAt IS NULL
 * AND ( role = 'admin'
 *    OR visibility = 'company'
 *    OR uploaderId = ctx.userId
 *    OR EXISTS (grant for this file and this user) )
 * ```
 *
 * A file this rejects is indistinguishable from one that does not exist: callers
 * answer **404, never 403**, so a restricted file's existence is not disclosed.
 */
export function visibilityCondition(
  alias: string,
  viewer: FileViewer,
): { sql: string; params: Record<string, string> } {
  if (viewer.role === 'admin') return { sql: `${alias}."deletedAt" IS NULL`, params: {} };

  return {
    sql:
      `${alias}."deletedAt" IS NULL AND (` +
      `${alias}."visibility" = 'company' ` +
      `OR ${alias}."uploaderId" = :fileViewerId ` +
      `OR EXISTS (SELECT 1 FROM "file_access_grant" "g" ` +
      `WHERE "g"."fileId" = ${alias}."id" AND "g"."userId" = :fileViewerId))`,
    params: { fileViewerId: viewer.userId },
  };
}

/**
 * Narrows a query already scoped to the caller's company (`TenantScope.forCompany`)
 * to the files the viewer may see. Filters a caller adds afterwards can only narrow
 * further — never widen.
 */
export function applyFileVisibility<Entity extends ObjectLiteral>(
  qb: SelectQueryBuilder<Entity>,
  alias: string,
  viewer: FileViewer,
): SelectQueryBuilder<Entity> {
  const { sql, params } = visibilityCondition(alias, viewer);
  return qb.andWhere(sql, params);
}
