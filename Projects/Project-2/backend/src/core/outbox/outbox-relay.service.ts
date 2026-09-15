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
const PERIODIC_SWEEP_INTERVAL_MS = 60_000;

/**
 * Server error codes for "this resume token is no longer usable". 286 is
 * ChangeStreamHistoryLost (the oplog no longer covers the resume point);
 * 280 is ChangeStreamFatalError. Both are permanent for the token we
 * hold: retrying with it can only fail the same way forever, so the only
 * recovery is to drop it and start a fresh stream.
 *
 * Hit for real: after the app sat idle for several days, every restart
 * logged "Resume of change stream was not possible, as the resume point
 * may no longer be in the oplog" on a 5-second loop, and no outbox event
 * — password resets, order mail, every async side effect — was ever
 * delivered again.
 */
const UNRESUMABLE_CODES = new Set([286, 280]);
const UNRESUMABLE_PATTERN = /resume point may no longer be in the oplog|ChangeStreamHistoryLost/i;

function isUnresumable(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === 'number' && UNRESUMABLE_CODES.has(code)) return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' && UNRESUMABLE_PATTERN.test(message);
}

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
  private sweepTimer?: ReturnType<typeof setInterval>;
  private sweeping = false;
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

    // The change stream is the fast path, not the guarantee. A publish that
    // throws is released back to unpublished (see claimAndPublish), and a
    // row inserted while the stream was down is never replayed by a fresh
    // stream — without this both would sit there until the next restart.
    this.sweepTimer = setInterval(() => {
      void this.runSweep('periodic');
    }, PERIODIC_SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    await this.changeStream?.close().catch(() => undefined);
  }

  private async runStartupSweep(): Promise<void> {
    await this.runSweep('startup');
  }

  /**
   * Republishes outbox rows that are still unpublished and older than the
   * cutoff. Guarded by `sweeping` so a slow sweep can't overlap the next
   * interval tick and double-claim (claim() is atomic, so an overlap would
   * be safe but wasteful).
   */
  private async runSweep(reason: 'startup' | 'periodic'): Promise<void> {
    if (this.stopped || this.sweeping) return;
    this.sweeping = true;
    try {
      const cutoff = new Date(Date.now() - STARTUP_SWEEP_AGE_MS);
      const stale = await this.outboxRepository.findUnpublishedOlderThan(cutoff);

      if (stale.length === 0) return;

      this.logger.warn(
        `${reason === 'startup' ? 'Startup' : 'Periodic'} sweep found ${stale.length} unpublished outbox row(s) — republishing`,
      );
      for (const event of stale) {
        await this.claimAndPublish(event.id);
      }
    } catch (error) {
      this.logger.error(
        `Outbox ${reason} sweep failed: ${error instanceof Error ? error.message : error}`,
      );
    } finally {
      this.sweeping = false;
    }
  }

  private async startWatching(): Promise<void> {
    if (this.stopped) return;

    // Close the previous stream before opening another — a reconnect that
    // leaves the old one attached stacks a second 'change' listener and
    // double-publishes every subsequent event.
    await this.changeStream?.close().catch(() => undefined);

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
      if (this.stopped) return;

      if (isUnresumable(error)) {
        // Retrying with this token can only reproduce the same failure, so
        // drop it and re-sweep: the sweep republishes every row written
        // while the stream was down, which is exactly the set the fresh
        // (now-only) stream will not replay.
        this.logger.warn(
          'Resume token is no longer in the oplog — discarding it, sweeping for missed rows, and starting a fresh stream',
        );
        void this.recoverFromLostToken();
        return;
      }

      setTimeout(() => void this.startWatching(), RECONNECT_DELAY_MS);
    });

    this.logger.log(
      `Outbox relay watching for new events${resumeToken ? ' (resumed)' : ''}`,
    );
  }

  private async recoverFromLostToken(): Promise<void> {
    try {
      await this.checkpointRepository.clearResumeToken(OUTBOX_STREAM_NAME);
      await this.runStartupSweep();
      await this.startWatching();
    } catch (error) {
      this.logger.error(
        `Failed to recover the outbox stream: ${error instanceof Error ? error.message : error}`,
      );
      if (!this.stopped) {
        setTimeout(() => void this.startWatching(), RECONNECT_DELAY_MS);
      }
    }
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
      change._id,
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
        // Without this, claim()'s optimistic publishedAt write stands —
        // the row looks published, the startup sweep's `publishedAt: null`
        // filter never sees it again, and the event is silently lost
        // rather than retried. This only recovers it on the *next*
        // startup sweep, not continuously while the process stays up —
        // there's no scheduled re-sweep yet. Good enough to stop losing
        // events outright; a periodic retry sweep is a real follow-up.
        await this.outboxRepository.release(id);
      }
    });
  }
}
