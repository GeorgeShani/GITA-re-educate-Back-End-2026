import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { QueueName } from '@/core/queues/queue-names.enum';
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

/**
 * Reads a required string field off an outbox job's payload. `payload` is
 * `Record<string, unknown>` — its shape varies per event name, so it
 * can't be typed any narrower here — and every consumer used to reach
 * for `payload.x as string` to read one back out. A real check instead:
 * a malformed/renamed field now fails loudly with the field name in the
 * message, rather than an `undefined` silently masquerading as a string
 * three calls downstream.
 */
export function readPayloadString(
  payload: Record<string, unknown>,
  key: string,
): string {
  const value = payload[key];
  if (typeof value !== 'string') {
    throw new Error(
      `Expected outbox payload.${key} to be a string, got ${typeof value}`,
    );
  }
  return value;
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
    @InjectQueue(QueueName.MEDIA) mediaQueue: Queue,
    @InjectQueue(QueueName.INVOICES) invoicesQueue: Queue,
  ) {
    this.queues = new Map([
      [QueueName.AUDIT_LOG, auditLogQueue],
      [QueueName.NOTIFICATIONS, notificationsQueue],
      [QueueName.MEDIA, mediaQueue],
      [QueueName.INVOICES, invoicesQueue],
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
          //
          // `.` not `:` — BullMQ rejects a custom jobId containing `:`
          // unless splitting on it yields exactly 3 parts (a legacy
          // repeatable-job compatibility check, job.js's own TODO says
          // it'll tighten to a blanket ban later). queueName:eventId is
          // 2 parts, so every publish was failing with "Custom Id cannot
          // contain :" — this was silently breaking every event publish
          // (audit log, notification emails, ...) since this code was
          // written; nothing parses job.id back apart, so any delimiter
          // BullMQ won't choke on works.
          jobId: `${queueName}.${eventId}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { age: 60 * 60 * 24 }, // 24h, then evict
          removeOnFail: { age: 60 * 60 * 24 * 7 }, // keep failures a week for triage
        });
      }),
    );
  }
}
