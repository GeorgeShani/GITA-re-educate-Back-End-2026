import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { QueueName } from '../queues/queue-names.enum';
import { resolveQueuesForEvent } from './event-routing';
import { OutboxEventDocument } from './outbox.schema';

export interface OutboxJobData {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventName: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  correlationId: string;
}

// Fans a claimed outbox row out to every queue its event name routes to
// (event-routing.ts). Add a new @InjectQueue(...) here in the same
// change that registers a new queue in CoreModule and adds its pattern
// to EVENT_ROUTES — see queue-names.enum.ts for why routing ahead of a
// registered queue is deliberately avoided.
@Injectable()
export class OutboxPublisher {
  private readonly queues: Map<QueueName, Queue>;

  constructor(
    @InjectQueue(QueueName.AUDIT_LOG) auditLogQueue: Queue,
    @InjectQueue(QueueName.NOTIFICATIONS) notificationsQueue: Queue,
  ) {
    this.queues = new Map([
      [QueueName.AUDIT_LOG, auditLogQueue],
      [QueueName.NOTIFICATIONS, notificationsQueue],
    ]);
  }

  async publish(event: OutboxEventDocument): Promise<void> {
    const targetQueues = resolveQueuesForEvent(event.eventName);
    const eventId = event._id.toString();

    const jobData: OutboxJobData = {
      eventId,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      eventName: event.eventName,
      payload: event.payload,
      occurredAt: event.occurredAt,
      correlationId: event.correlationId,
    };

    await Promise.all(
      targetQueues.map((queueName) => {
        const queue = this.queues.get(queueName);
        // Declared in the routing table but not yet registered (its
        // consumer slice hasn't landed) — nothing to do yet.
        if (!queue) return Promise.resolve();

        return queue.add(event.eventName, jobData, {
          // Unique per queue+event so a duplicate publish attempt (e.g.
          // a change-stream notification replayed after a crash, before
          // this row's claim was durable) can't double-enqueue.
          jobId: `${queueName}:${eventId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 60 * 60 * 24 }, // 24h, then evict
          removeOnFail: { age: 60 * 60 * 24 * 7 }, // keep failures a week for triage
        });
      }),
    );
  }
}
