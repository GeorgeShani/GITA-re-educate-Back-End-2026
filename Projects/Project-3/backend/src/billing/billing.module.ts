import { Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { InvoicingService } from './invoicing.service.js';
import { StatementService } from './statement.service.js';
import { UsageService } from './usage.service.js';

/**
 * The billing engine's database-facing half. `calculator.ts` and `period.ts`
 * are the pure half (no Nest). This module never imports `SubscriptionsModule`,
 * so the two stay acyclic — `SubscriptionsModule` depends on this one. The
 * rollover job needs both, so it lives one level up in `BillingCycleModule`.
 */
@Module({
  imports: [DatabaseModule],
  controllers: [BillingController],
  providers: [UsageService, StatementService, InvoicingService, BillingService],
  exports: [UsageService, StatementService, InvoicingService],
})
export class BillingModule {}
