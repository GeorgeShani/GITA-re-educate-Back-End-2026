import type { EntitySubscriberInterface } from 'typeorm';
import { AuditLogEntry } from '#/core/audit/audit-log-entry.entity.js';
import type { RealtimeEmitter } from './realtime-emitter.service.js';

/**
 * Announces audit entries to admins — but only once the transaction that wrote them has COMMITTED.
 *
 * Entries are written inside the same transaction as the change they describe, so emitting at
 * insert time would announce things that might still roll back. Instead each insert is parked
 * against its query runner, and released when that runner commits (or dropped if it rolls back).
 * TypeORM tells every subscriber about every commit, and an insert outside an explicit
 * transaction is committed by TypeORM's own, so the same path covers both.
 *
 * Registered at runtime by `RealtimeModule` (a subscriber has no DI of its own), so an app
 * context without realtime — the CLI jobs — writes audit entries and broadcasts nothing.
 */
export class AuditBroadcaster implements EntitySubscriberInterface<AuditLogEntry> {
  private readonly pending = new WeakMap<object, AuditLogEntry[]>();

  constructor(private readonly emitter: Pick<RealtimeEmitter, 'auditAppended'>) {}

  listenTo(): typeof AuditLogEntry {
    return AuditLogEntry;
  }

  // The events are typed by what is used (TypeORM's own event types satisfy these), so the class
  // can be exercised without constructing a real query runner.
  afterInsert(event: { queryRunner: object; entity: AuditLogEntry }): void {
    const runner = event.queryRunner;
    const parked = this.pending.get(runner) ?? [];
    parked.push(event.entity);
    this.pending.set(runner, parked);
  }

  afterTransactionCommit(event: { queryRunner: object }): void {
    const parked = this.pending.get(event.queryRunner);
    if (!parked) return;
    this.pending.delete(event.queryRunner);
    for (const entry of parked) void this.emitter.auditAppended(entry);
  }

  afterTransactionRollback(event: { queryRunner: object }): void {
    this.pending.delete(event.queryRunner);
  }
}
