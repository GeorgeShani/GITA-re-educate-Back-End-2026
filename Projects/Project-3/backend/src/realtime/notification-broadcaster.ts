import type { EntitySubscriberInterface } from 'typeorm';
import { Notification } from '#/notifications/notification.entity.js';
import { AfterCommitQueue } from './after-commit-queue.js';
import type { RealtimeEmitter } from './realtime-emitter.service.js';

/**
 * Pushes a new inbox entry to its owner's sockets — only after the transaction that wrote it has
 * COMMITTED (see `AfterCommitQueue`), so a notification for an upload that rolled back is never shown.
 * Registered by `RealtimeModule`; a context without sockets writes the rows and pushes nothing.
 */
export class NotificationBroadcaster implements EntitySubscriberInterface<Notification> {
  private readonly parked = new AfterCommitQueue<Notification>();

  constructor(private readonly emitter: Pick<RealtimeEmitter, 'notificationCreated'>) {}

  listenTo(): typeof Notification {
    return Notification;
  }

  afterInsert(event: { queryRunner: object; entity: Notification }): void {
    this.parked.park(event.queryRunner, event.entity);
  }

  afterTransactionCommit(event: { queryRunner: object }): void {
    for (const row of this.parked.release(event.queryRunner)) void this.emitter.notificationCreated(row);
  }

  afterTransactionRollback(event: { queryRunner: object }): void {
    this.parked.drop(event.queryRunner);
  }
}
