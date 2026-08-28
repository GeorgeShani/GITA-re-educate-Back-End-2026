import { Processor } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { QueueName } from '@/core/queues/queue-names.enum';
import { BaseConsumer } from '@/core/queues/base.consumer';
import { OutboxJobData } from '@/core/outbox/outbox.publisher';
import { AuditLogEntry, AuditLogEntryDocument } from './audit-log-entry.schema';

@Injectable()
@Processor(QueueName.AUDIT_LOG)
export class AuditLogConsumer extends BaseConsumer {
  constructor(
    @InjectModel(AuditLogEntry.name)
    private readonly auditLogModel: Model<AuditLogEntryDocument>,
    cls: ClsService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<OutboxJobData>): Promise<void> {
    const {
      eventId,
      eventName,
      aggregateType,
      aggregateId,
      payload,
      occurredAt,
      correlationId,
    } = job.data;

    // Upsert on eventId rather than a plain insert — a redelivered job
    // (retry after a crash between "wrote the row" and "marked complete")
    // must be a no-op, not a duplicate audit entry.
    await this.auditLogModel.updateOne(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          eventName,
          aggregateType,
          aggregateId,
          payload,
          occurredAt,
          correlationId,
        },
      },
      { upsert: true },
    );
  }
}
