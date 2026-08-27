import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter } from 'mongoose';

import { PaginatedResult } from '../../catalog/products.service';
import { FindAuditLogDto } from './dto/find-audit-log.dto';
import { AuditLogEntry, AuditLogEntryDocument } from './audit-log-entry.schema';

// Read side for a collection the consumer (audit-log.consumer.ts) has been
// writing to since S2 — nothing has ever queried it back until now. Plain
// service, not CQRS: a list/filter read has nothing to coordinate
// transactionally, same convention as every other admin read this phase.
@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLogEntry.name)
    private readonly auditLogModel: Model<AuditLogEntryDocument>,
  ) {}

  async findAll(
    query: FindAuditLogDto,
  ): Promise<PaginatedResult<AuditLogEntryDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<AuditLogEntryDocument> = {};
    if (query.eventName) filter.eventName = query.eventName;
    if (query.aggregateType) filter.aggregateType = query.aggregateType;
    if (query.aggregateId) filter.aggregateId = query.aggregateId;
    if (query.correlationId) filter.correlationId = query.correlationId;

    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ occurredAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  /** The dashboard's "live activity feed" — just the newest entries, no filters. */
  async findRecent(limit: number): Promise<AuditLogEntryDocument[]> {
    return this.auditLogModel
      .find({})
      .sort({ occurredAt: -1 })
      .limit(limit)
      .exec();
  }
}
