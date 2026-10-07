import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';

/** A task that died this long ago is tried again, and only if it is younger than `REVIVE_WITHIN_MS`. */
export const REVIVE_AFTER_MS = 6 * 60 * 60 * 1000;
export const REVIVE_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Catches up what Stripe was never told. A Premium upload is a meter event and a seat change is a quantity, and each is a
 * queued task that gives up after five attempts. Without this, an outage at Stripe longer than the retries loses that
 * revenue for good, because nothing looks at a dead task again.
 *
 * Both tasks are safe to run twice: the meter event carries the immutable usage-event id, and a seat update carries its
 * sequence number, so Stripe de-duplicates either. A task that keeps failing for a reason that is not an outage is given up
 * on after a week.
 */
@Injectable()
export class StripeSyncJanitor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.logger.setContext(StripeSyncJanitor.name);
  }

  /** Puts the dead Stripe tasks of the last week back on the queue. Returns how many. Safe to run twice. */
  async reviveDeadTasks(now: Date = this.clock.now()): Promise<number> {
    // For an UPDATE … RETURNING the Postgres driver answers `[rows, affectedCount]`, not the rows themselves.
    const answer: unknown = await this.dataSource.query(
      `UPDATE background_task
          SET status = 'pending', attempts = 0, "runAfter" = $1, "lockedAt" = NULL, "updatedAt" = $1
        WHERE status = 'dead'
          AND type IN ('sync_stripe_seats', 'report_stripe_usage')
          AND "updatedAt" < $2
          AND "createdAt" > $3
        RETURNING id`,
      [now, new Date(now.getTime() - REVIVE_AFTER_MS), new Date(now.getTime() - REVIVE_WITHIN_MS)],
    );
    const revived = z.tuple([z.array(z.object({ id: z.string() })), z.number()]).safeParse(answer);
    return revived.success ? revived.data[0].length : 0;
  }

  /** Every six hours. A no-op under test (specs call `reviveDeadTasks`) and while generating docs. */
  @Cron('23 */6 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    if (this.config.isTest || this.config.DB_SKIP_CONNECT) return;
    try {
      const revived = await this.reviveDeadTasks();
      if (revived > 0) this.logger.warn({ revived }, 'Retrying Stripe syncs that had given up');
    } catch (error) {
      this.logger.error({ err: error }, 'Stripe sync catch-up failed');
    }
  }
}
