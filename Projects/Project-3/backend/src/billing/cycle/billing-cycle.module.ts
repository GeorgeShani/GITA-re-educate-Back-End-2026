import { Module } from '@nestjs/common';
import { BillingModule } from '#/billing/billing.module.js';
import { DatabaseModule } from '#/database/database.module.js';
import { SubscriptionsModule } from '#/subscriptions/subscriptions.module.js';
import { BillingCycleScheduler } from './billing-cycle.scheduler.js';
import { BillingCycleService } from './billing-cycle.service.js';

/**
 * The rollover job. It needs `BillingModule` (invoicing) AND `SubscriptionsModule`
 * (the row lock), which cannot depend on each other's parent — hence its own module.
 * Also what the `billing:run-cycle` CLI boots, without HTTP.
 */
@Module({
  imports: [DatabaseModule, BillingModule, SubscriptionsModule],
  providers: [BillingCycleService, BillingCycleScheduler],
  exports: [BillingCycleService],
})
export class BillingCycleModule {}
