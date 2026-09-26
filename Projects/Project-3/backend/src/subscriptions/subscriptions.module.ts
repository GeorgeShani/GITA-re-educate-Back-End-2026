import { Module } from '@nestjs/common';
import { BillingModule } from '#/billing/billing.module.js';
import { DatabaseModule } from '#/database/database.module.js';
import { PaymentsModule } from '#/payments/payments.module.js';
import { RequireSubscriptionGuard } from './require-subscription.guard.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';

@Module({
  imports: [DatabaseModule, BillingModule, PaymentsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, RequireSubscriptionGuard],
  // `RequireSubscriptionGuard` is exported so `AccessControlModule` can register it globally.
  exports: [SubscriptionsService, RequireSubscriptionGuard],
})
export class SubscriptionsModule {}
