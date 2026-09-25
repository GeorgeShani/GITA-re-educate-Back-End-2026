import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { IdempotencyRecord } from './idempotency-record.entity.js';
import { IDEMPOTENCY_STALE_CLAIM_MS, IDEMPOTENCY_TTL_MS } from './idempotency.interceptor.js';

/**
 * Deletes idempotency records nobody can use any more.
 *
 * The interceptor already ignores an expired record (it deletes and replaces the one it trips over),
 * but a key that is never sent again is never tripped over, so without this the table only grows. A
 * record is dead once it is older than the replay window (`IDEMPOTENCY_TTL_MS`), or was an
 * `in_progress` claim from a request that crashed (`IDEMPOTENCY_STALE_CLAIM_MS`) — exactly the two
 * conditions under which the interceptor treats it as gone, so deleting it changes no behaviour.
 *
 * It scans by `createdAt`, which the `(companyId, key)` unique index does not serve; that is fine for
 * a table that only ever holds a day of records. If it ever isn't, add an index on `createdAt`.
 */
@Injectable()
export class IdempotencyJanitor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.logger.setContext(IdempotencyJanitor.name);
  }

  /** Removes every dead record as of `now`. Returns how many. Safe to run concurrently or twice. */
  async purge(now: Date = this.clock.now()): Promise<number> {
    const expired = new Date(now.getTime() - IDEMPOTENCY_TTL_MS);
    const abandoned = new Date(now.getTime() - IDEMPOTENCY_STALE_CLAIM_MS);

    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(IdempotencyRecord)
      .where(`"createdAt" < :expired OR ("status" = 'in_progress' AND "createdAt" < :abandoned)`, {
        expired,
        abandoned,
      })
      .execute();
    return result.affected ?? 0;
  }

  /** Hourly. A no-op under test (specs call `purge`) and while generating docs. */
  @Cron('17 * * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    if (this.config.isTest || this.config.DB_SKIP_CONNECT) return;
    try {
      const removed = await this.purge();
      if (removed > 0) this.logger.info({ removed }, 'Purged expired idempotency records');
    } catch (error) {
      this.logger.error({ err: error }, 'Idempotency purge failed');
    }
  }
}
