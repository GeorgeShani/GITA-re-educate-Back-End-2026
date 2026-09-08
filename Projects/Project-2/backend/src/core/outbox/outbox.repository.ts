import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ChangeStream, ChangeStreamInsertDocument } from 'mongodb';
import { ClientSession, Model } from 'mongoose';

import { DomainEvent } from '@/core/events/domain-event.base';
import { OutboxEvent, OutboxEventDocument } from './outbox.schema';

@Injectable()
export class OutboxRepository {
  constructor(
    @InjectModel(OutboxEvent.name)
    private readonly outboxModel: Model<OutboxEventDocument>,
  ) {}

  /**
   * Writes one outbox row as part of an existing Mongo transaction —
   * always call this alongside the entity write, inside the same
   * `session`, never on its own. See TransactionalCommandHandler.
   */
  async write(event: DomainEvent, session: ClientSession): Promise<void> {
    await this.outboxModel.create(
      [
        {
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
          eventName: event.eventName,
          payload: { ...event },
          occurredAt: event.occurredAt,
          publishedAt: null,
          attempts: 0,
          correlationId: event.correlationId,
        },
      ],
      { session },
    );
  }

  /**
   * Atomically claims one row for publishing — the Mongo equivalent of
   * `SELECT ... FOR UPDATE SKIP LOCKED`. Returns null if the row is
   * already claimed (by this or another relay instance) or doesn't
   * exist, so callers can safely no-op on a duplicate change-stream
   * notification.
   */
  async claim(id: string): Promise<OutboxEventDocument | null> {
    return this.outboxModel.findOneAndUpdate(
      { _id: id, publishedAt: null },
      { $set: { publishedAt: new Date() }, $inc: { attempts: 1 } },
      { returnDocument: 'after' },
    );
  }

  /**
   * Reverts a claim when the publish attempt itself throws — `claim()`
   * sets `publishedAt` optimistically, before the queue.add() calls it
   * guards actually succeed, so without this a failed publish looks
   * identical to a successful one: `findUnpublishedOlderThan`'s sweep and
   * the live change stream (insert-only) both stop seeing the row, and
   * the event is gone for good with nothing but the error log to show
   * for it. Only resets `publishedAt` if this claim is still the most
   * recent one (`$set` from a matching `_id` — a second claim can't have
   * happened between this claim and its failure, since publish is
   * awaited synchronously in the same call), so a retry from a fresh
   * relay instance can't be undone by a stale unclaim.
   */
  async release(id: string): Promise<void> {
    await this.outboxModel.updateOne(
      { _id: id },
      { $set: { publishedAt: null } },
    );
  }

  /**
   * The startup sweep's query — unpublished rows older than `cutoff`.
   * Covers the rare case where a resume token itself was lost, so a row
   * written while the relay was down never gets picked up by the change
   * stream at all.
   */
  async findUnpublishedOlderThan(
    cutoff: Date,
    limit = 100,
  ): Promise<OutboxEventDocument[]> {
    return this.outboxModel
      .find({ publishedAt: null, occurredAt: { $lt: cutoff } })
      .sort({ occurredAt: 1 })
      .limit(limit)
      .exec();
  }

  /**
   * Opens a change stream on inserts only — updates from `claim()` itself
   * would otherwise also notify, which the relay doesn't need to react
   * to. Resumes from `resumeToken` when provided (see StreamCheckpoint).
   */
  watchInserts(
    resumeToken: Record<string, unknown> | null,
  ): ChangeStream<OutboxEvent, ChangeStreamInsertDocument<OutboxEvent>> {
    return this.outboxModel.watch<
      OutboxEvent,
      ChangeStreamInsertDocument<OutboxEvent>
    >(
      [{ $match: { operationType: 'insert' } }],
      resumeToken ? { resumeAfter: resumeToken } : {},
    );
  }
}
