import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { WebhookDelivery } from './webhook-delivery.entity.js';

export const WEBHOOK_DELIVERY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Deletes delivery history after its documented operational retention period. */
@Injectable()
export class WebhookDeliveriesJanitor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.logger.setContext(WebhookDeliveriesJanitor.name);
  }

  /** Removes deliveries older than 30 days. Returns the number removed and is safe to repeat. */
  async purge(now: Date = this.clock.now()): Promise<number> {
    const cutoff = new Date(now.getTime() - WEBHOOK_DELIVERY_RETENTION_MS);
    const result = await this.dataSource
      .createQueryBuilder()
      .delete()
      .from(WebhookDelivery)
      .where('"createdAt" < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  /** Daily. Tests invoke `purge` directly and documentation generation never connects. */
  @Cron('19 4 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    if (this.config.isTest || this.config.DB_SKIP_CONNECT) return;
    try {
      const removed = await this.purge();
      if (removed > 0) {
        this.logger.info({ removed }, 'Purged expired webhook deliveries');
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Webhook delivery purge failed');
    }
  }
}
