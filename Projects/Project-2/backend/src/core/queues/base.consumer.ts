import { Injectable, Logger } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import { OutboxJobData } from '@/core/outbox/outbox.publisher';

// Every queue consumer extends this rather than WorkerHost directly.
// Handles the two things every consumer needs regardless of what it
// does: restoring the correlationId into CLS (so its logs and any
// errors tie back to the original request — SCOPE.md B2) and rethrowing
// on failure so BullMQ's retry/backoff policy (set when the job was
// added — see OutboxPublisher) actually applies.
//
// Idempotency is each concrete consumer's own responsibility, keyed on
// `job.data.eventId` — e.g. an upsert, or a unique index that turns a
// duplicate insert into a no-op. BullMQ's jobId dedup (also keyed on
// eventId, see OutboxPublisher) covers the common case but isn't a
// substitute for this: a job can still be redelivered after a crash
// between "did the work" and "marked complete".
@Injectable()
export abstract class BaseConsumer extends WorkerHost {
  protected readonly logger = new Logger(this.constructor.name);

  constructor(protected readonly cls: ClsService) {
    super();
  }

  async process(job: Job<OutboxJobData>): Promise<unknown> {
    // ClsService's default ClsStore type only declares a symbol index
    // signature, so a plain object literal can't be passed to
    // runWith() — set() has a loosely-typed string-key fallback instead
    // (same pattern AppModule uses for the HTTP-request leg of this).
    return this.cls.run(async () => {
      this.cls.set('correlationId', job.data.correlationId);
      try {
        return await this.handle(job);
      } catch (error) {
        this.logger.error(
          `Job ${job.id} (${job.name}) failed: ${error instanceof Error ? error.message : error}`,
        );
        throw error;
      }
    });
  }

  protected abstract handle(job: Job<OutboxJobData>): Promise<unknown>;
}
