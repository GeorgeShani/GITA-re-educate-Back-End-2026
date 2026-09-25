import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { Notification } from './notification.entity.js';

/** A read notification is kept this long. An unread one is never purged: somebody still has to see it. */
export const READ_NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Deletes read notifications past their retention, so an inbox does not grow for ever. */
@Injectable()
export class NotificationsJanitor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.logger.setContext(NotificationsJanitor.name);
  }

  /** Removes what was read more than 90 days before `now`. Returns how many. Safe to run twice. */
  async purge(now: Date = this.clock.now()): Promise<number> {
    const cutoff = new Date(now.getTime() - READ_NOTIFICATION_RETENTION_MS);
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('"readAt" IS NOT NULL AND "readAt" < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  /** Daily. A no-op under test (specs call `purge`) and while generating docs. */
  @Cron('43 3 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    if (this.config.isTest || this.config.DB_SKIP_CONNECT) return;
    try {
      const removed = await this.purge();
      if (removed > 0) this.logger.info({ removed }, 'Purged old read notifications');
    } catch (error) {
      this.logger.error({ err: error }, 'Notification purge failed');
    }
  }
}
