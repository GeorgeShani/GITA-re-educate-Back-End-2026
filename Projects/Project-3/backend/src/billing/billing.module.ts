import { Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { InvoicingService } from './invoicing.service.js';
import { StatementService } from './statement.service.js';
import { UsageService } from './usage.service.js';

/**
 * The billing engine's database-facing half. `calculator.ts` and `period.ts`
 * are the pure half (no Nest). Phase 7 adds the controllers and the rollover
 * job to this module; it never imports `SubscriptionsModule`, so the two stay
 * acyclic — `SubscriptionsModule` depends on this one.
 */
@Module({
  imports: [DatabaseModule],
  providers: [UsageService, StatementService, InvoicingService],
  exports: [UsageService, StatementService, InvoicingService],
})
export class BillingModule {}
