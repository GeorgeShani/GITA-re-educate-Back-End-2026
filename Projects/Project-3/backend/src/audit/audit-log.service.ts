import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { decodeCursor } from '#/common/pagination/cursor.js';
import { applyCursor, toCursorPage } from '#/common/pagination/paginate.js';
import type { CursorPage } from '#/common/pagination/paginated-result.js';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { TenantScope } from '#/database/tenant-scope.js';
import type { AuditQueryDto } from './dto/audit-query.dto.js';

/** Everything but `metadata`: the list never loads the jsonb. */
const LIST_COLUMNS = [
  'a.id',
  'a.companyId',
  'a.actorUserId',
  'a.action',
  'a.targetType',
  'a.targetId',
  'a.ip',
  'a.correlationId',
  'a.createdAt',
  'a.updatedAt',
];

/**
 * Reads the audit log. Writing is `AuditService` (the only writer, and append-only down
 * to a database trigger); this is its read side, kept apart so that nothing that can
 * read the log can also touch it.
 */
@Injectable()
export class AuditLogService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly context: RequestContextService,
  ) {}

  /**
   * Newest first, keyset-paginated on `(createdAt DESC, id DESC)` — exactly the order of
   * `idx_audit_log_company_created`, so a page is an index range scan however deep the
   * log grows. Filters only narrow what the tenant scope already allows.
   */
  async list(query: AuditQueryDto): Promise<CursorPage<AuditLogEntry>> {
    const qb = this.tenantScope
      .forCompany(this.dataSource.getRepository(AuditLogEntry), this.context.requireCompanyId(), 'a')
      .select(LIST_COLUMNS);

    if (query.action) qb.andWhere('a.action = :action', { action: query.action });
    if (query.actorUserId) qb.andWhere('a.actorUserId = :actorUserId', { actorUserId: query.actorUserId });
    if (query.targetType) qb.andWhere('a.targetType = :targetType', { targetType: query.targetType });
    if (query.from) qb.andWhere('a.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('a.createdAt < :to', { to: query.to });

    applyCursor(qb, 'a', query.cursor ? decodeCursor(query.cursor) : undefined, 'DESC');
    return toCursorPage(qb, query.limit);
  }

  /** One entry, `metadata` included. Another company's entry is a 404. */
  async get(id: string): Promise<AuditLogEntry> {
    const entry = await this.tenantScope
      .forCompany(this.dataSource.getRepository(AuditLogEntry), this.context.requireCompanyId(), 'a')
      .andWhere('a.id = :id', { id })
      .getOne();
    if (!entry) throw new NotFoundException('Audit entry not found');
    return entry;
  }
}
