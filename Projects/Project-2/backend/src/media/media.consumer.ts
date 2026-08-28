import { Inject } from '@nestjs/common';
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import { BaseConsumer } from '@/core/queues/base.consumer';
import { QueueName } from '@/core/queues/queue-names.enum';
import { OutboxJobData } from '@/core/outbox/outbox.publisher';
import { STORAGE_PROVIDER_TOKEN } from './providers/storage-provider.interface';
import type { StorageProvider } from './providers/storage-provider.interface';

// Only media.deleted is routed here (see event-routing.ts) — the actual
// Cloudinary destroy() call, which is the external side effect that
// couldn't happen inside DeleteMediaHandler's transaction. media.uploaded
// needs no consumer: registering the doc is pure bookkeeping with no
// external side effect, so RegisterMediaHandler does it synchronously.
@Processor(QueueName.MEDIA)
export class MediaConsumer extends BaseConsumer {
  constructor(
    cls: ClsService,
    @Inject(STORAGE_PROVIDER_TOKEN)
    private readonly storageProvider: StorageProvider,
  ) {
    super(cls);
  }

  protected async handle(job: Job<OutboxJobData>): Promise<unknown> {
    if (job.data.eventName !== 'media.deleted') {
      this.logger.warn(
        `MediaConsumer received unexpected event "${job.data.eventName}" — skipping`,
      );
      return;
    }

    const publicId = job.data.payload.publicId as string;
    // Idempotent by nature — destroying an already-destroyed public_id
    // is a documented no-op in Cloudinary's API, so a redelivered job
    // needs no extra guard here.
    await this.storageProvider.destroy(publicId);
  }
}
