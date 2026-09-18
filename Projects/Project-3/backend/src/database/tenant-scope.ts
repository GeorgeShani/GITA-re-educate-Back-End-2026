import { Injectable } from '@nestjs/common';
import type { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';

/**
 * The one way a tenant-scoped query is ever built.
 *
 * Every table that carries a `companyId` column goes through this — see
 * `AGENTS.md`'s "never hand-roll a `where: { companyId }`" rule — so the
 * tenant boundary is enforced at one choke point rather than trusted to be
 * repeated correctly in every service that touches a tenant-scoped table.
 *
 * The generic constraint (`Entity extends ObjectLiteral & { companyId: string }`)
 * is deliberate: it is a compile-time guarantee that this can only be used
 * with an entity that actually declares `companyId`, not just a runtime
 * convention someone has to remember to follow.
 */
@Injectable()
export class TenantScope {
  /**
   * A query builder pre-filtered to one company's rows. `alias` must match
   * whatever alias the caller uses for further `.andWhere()`/`.orderBy()`
   * calls — it defaults to the table name, which is right for the common
   * case of a single-entity query with no joins.
   */
  forCompany<Entity extends ObjectLiteral & { companyId: string }>(
    repository: Repository<Entity>,
    companyId: string,
    alias: string = repository.metadata.tableName,
  ): SelectQueryBuilder<Entity> {
    return repository
      .createQueryBuilder(alias)
      .where(`${alias}.companyId = :companyId`, { companyId });
  }
}
