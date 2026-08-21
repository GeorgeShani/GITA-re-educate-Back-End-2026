import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ChangeStream, ChangeStreamInsertDocument } from 'mongodb';
import { ClsService } from 'nestjs-cls';

import { OutboxEvent } from './outbox.schema';
import { OutboxPublisher } from './outbox.publisher';
import { OutboxRepository } from './outbox.repository';
import {
  OUTBOX_STREAM_NAME,
  StreamCheckpointRepository,
} from './stream-checkpoint.repository';

const STARTUP_SWEEP_AGE_MS = 30_000; // rows older than this with no publishedAt got missed somehow
const RECONNECT_DELAY_MS = 5_000;

// SCOPE.md B2 — the outbox relay. A change stream on `outboxevents`
// notifies this service the moment a row is inserted; each row is
// claimed atomically (OutboxRepository.claim — the Mongo equivalent of
// `SELECT ... FOR UPDATE SKIP LOCKED`) before being fanned out to BullMQ,
// so running multiple relay instances is safe.
//
// The resume token is persisted after every event, and a startup sweep
// republishes anything that predates this instance's stream (the safety
// net for a lost token, or a row written while no relay was running).
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private changeStream?: ChangeStream<
    OutboxEvent,
    ChangeStreamInsertDocument<OutboxEvent>
  >;
  private stopped = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    private readonly checkpointRepository: StreamCheckpointRepository,
    private readonly publisher: OutboxPublisher,
    private readonly cls: ClsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.runStartupSweep();
    await this.startWatching();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.changeStream?.close();
  }

  private async runStartupSweep(): Promise<void> {
    const cutoff = new Date(Date.now() - STARTUP_SWEEP_AGE_MS);
    const stale = await this.outboxRepository.findUnpublishedOlderThan(cutoff);

    if (stale.length === 0) return;

    this.logger.warn(
      `Startup sweep found ${stale.length} unpublished outbox row(s) — republishing`,
    );
    for (const event of stale) {
      await this.claimAndPublish(event.id);
    }
  }

  private async startWatching(): Promise<void> {
    const resumeToken =
      await this.checkpointRepository.getResumeToken(OUTBOX_STREAM_NAME);
    this.changeStream = this.outboxRepository.watchInserts(resumeToken);

    this.changeStream.on('change', (change) => {
      void this.handleChange(change);
    });

    this.changeStream.on('error', (error) => {
      this.logger.error(
        `Outbox change stream error: ${error instanceof Error ? error.message : error}`,
      );
      if (!this.stopped) {
        setTimeout(() => void this.startWatching(), RECONNECT_DELAY_MS);
      }
    });

    this.logger.log(
      `Outbox relay watching for new events${resumeToken ? ' (resumed)' : ''}`,
    );
  }

  private async handleChange(
    change: ChangeStreamInsertDocument<OutboxEvent>,
  ): Promise<void> {
    const id = change.documentKey._id.toString();

    await this.claimAndPublish(id);

    // Persist the resume token after processing, not before — if the
    // process dies mid-publish, the next boot's startup sweep still
    // finds this row (still unpublished) rather than the token skipping
    // past it.
    await this.checkpointRepository.saveResumeToken(
      OUTBOX_STREAM_NAME,
      change._id as Record<string, unknown>,
    );
  }

  private async claimAndPublish(id: string): Promise<void> {
    const claimed = await this.outboxRepository.claim(id);
    // Already claimed by this or another relay instance, or gone —
    // nothing to do. This is the expected, common case for the startup
    // sweep re-scanning a row the live change stream already handled.
    if (!claimed) return;

    // See BaseConsumer for why run()+set() rather than runWith() here.
    await this.cls.run(async () => {
      this.cls.set('correlationId', claimed.correlationId);
      try {
        await this.publisher.publish(claimed);
      } catch (error) {
        this.logger.error(
          `Failed to publish outbox event ${id} (${claimed.eventName}): ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    });
  }
}
