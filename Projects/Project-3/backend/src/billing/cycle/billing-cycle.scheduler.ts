import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PinoLogger } from 'nestjs-pino';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { BillingCycleService } from './billing-cycle.service.js';

/**
 * Runs the cycle daily, just after UTC midnight — the instant billing periods roll over.
 * A no-op under test (specs call `runCycle` directly) and while generating docs. If two
 * instances both fire, the per-company lock makes the second a no-op.
 */
@Injectable()
export class BillingCycleScheduler {
  constructor(
    private readonly cycle: BillingCycleService,
    private readonly logger: PinoLogger,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {
    this.logger.setContext(BillingCycleScheduler.name);
  }

  @Cron('5 0 * * *', { timeZone: 'UTC' })
  async run(): Promise<void> {
    if (this.config.isTest || this.config.DB_SKIP_CONNECT) return;

    try {
      const result = await this.cycle.runCycle();
      this.logger.info(result, 'Billing cycle finished');
    } catch (error) {
      this.logger.error({ err: error }, 'Billing cycle failed');
    }
  }
}
