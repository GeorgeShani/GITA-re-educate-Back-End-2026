import { Module } from '@nestjs/common';
import { BillingModule } from '#/billing/billing.module.js';
import { IdempotencyModule } from '#/core/idempotency/idempotency.module.js';
import { DatabaseModule } from '#/database/database.module.js';
import { PaymentsModule } from '#/payments/payments.module.js';
import { RequireSubscriptionGuard } from './require-subscription.guard.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  // Imported explicitly although the module is global: the billing-cycle CLI boots this module without AppModule.
  imports: [DatabaseModule, BillingModule, PaymentsModule, IdempotencyModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, RequireSubscriptionGuard],
  // `RequireSubscriptionGuard` is exported so `AccessControlModule` can register it globally.
  exports: [SubscriptionsService, RequireSubscriptionGuard],
})
export class SubscriptionsModule {}
