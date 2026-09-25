import type { EntitySubscriberInterface } from 'typeorm';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import { AfterCommitQueue } from './after-commit-queue.js';
import type { RealtimeEmitter } from './realtime-emitter.service.js';

/**
 * Announces audit entries to admins — but only once the transaction that wrote them has COMMITTED.
 *
 * Entries are written inside the same transaction as the change they describe, so emitting at
 * insert time would announce things that might still roll back. Instead each insert is parked
 * (`AfterCommitQueue`) against its query runner, and released when that runner commits (or dropped
 * if it rolls back).
 *
 * Registered at runtime by `RealtimeModule` (a subscriber has no DI of its own), so an app
 * context without realtime — the CLI jobs — writes audit entries and broadcasts nothing.
 */
export class AuditBroadcaster implements EntitySubscriberInterface<AuditLogEntry> {
  private readonly parked = new AfterCommitQueue<AuditLogEntry>();

  constructor(private readonly emitter: Pick<RealtimeEmitter, 'auditAppended'>) {}

  listenTo(): typeof AuditLogEntry {
    return AuditLogEntry;
  }

  // The events are typed by what is used (TypeORM's own event types satisfy these), so the class
  // can be exercised without constructing a real query runner.
  afterInsert(event: { queryRunner: object; entity: AuditLogEntry }): void {
    this.parked.park(event.queryRunner, event.entity);
  }

  afterTransactionCommit(event: { queryRunner: object }): void {
    for (const entry of this.parked.release(event.queryRunner)) void this.emitter.auditAppended(entry);
  }

  afterTransactionRollback(event: { queryRunner: object }): void {
    this.parked.drop(event.queryRunner);
  }
}
