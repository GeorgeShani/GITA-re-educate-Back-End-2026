import { Global, Module } from '@nestjs/common';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { DatabaseModule } from '#/database/database.module.js';
import { BillingIntentService } from './billing-intent.service.js';
import { NullPaymentProvider } from './null-payment.provider.js';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider.js';
import { StripePaymentProvider, type StripePaymentConfig } from './stripe-payment.provider.js';
import { DunningEvaluator } from './dunning-evaluator.service.js';
import { StripeWebhookController } from './stripe-webhook.controller.js';
import { StripeWebhookService } from './stripe-webhook.service.js';
import { BillingSyncService } from './billing-sync.service.js';
import { ReportStripeUsageHandler } from './report-stripe-usage.handler.js';
import { SyncStripeSeatsHandler } from './sync-stripe-seats.handler.js';

function required(value: string | undefined, key: string): string {
  if (!value) throw new Error(`${key} is required when PAYMENTS_PROVIDER=stripe.`);
  return value;
}

function stripeConfig(config: AppConfig): StripePaymentConfig {
  return {
    secretKey: required(config.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY'),
    webhookSecret: required(config.STRIPE_WEBHOOK_SECRET, 'STRIPE_WEBHOOK_SECRET'),
    basicBasePriceId: required(config.STRIPE_BASIC_BASE_PRICE_ID, 'STRIPE_BASIC_BASE_PRICE_ID'),
    basicSeatPriceId: required(config.STRIPE_BASIC_SEAT_PRICE_ID, 'STRIPE_BASIC_SEAT_PRICE_ID'),
    premiumBasePriceId: required(config.STRIPE_PREMIUM_BASE_PRICE_ID, 'STRIPE_PREMIUM_BASE_PRICE_ID'),
    premiumOveragePriceId: required(
      config.STRIPE_PREMIUM_OVERAGE_PRICE_ID,
      'STRIPE_PREMIUM_OVERAGE_PRICE_ID',
    ),
    meterEventName: required(config.STRIPE_FILE_METER_EVENT_NAME, 'STRIPE_FILE_METER_EVENT_NAME'),
    portalConfigurationId: required(
      config.STRIPE_PORTAL_CONFIGURATION_ID,
      'STRIPE_PORTAL_CONFIGURATION_ID',
    ),
    appPublicUrl: config.APP_PUBLIC_URL,
  };
}

function paymentProvider(config: AppConfig, disabled: NullPaymentProvider): PaymentProvider {
  return config.PAYMENTS_PROVIDER === 'stripe'
    ? new StripePaymentProvider(stripeConfig(config))
    : disabled;
}

@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [StripeWebhookController],
  providers: [
    NullPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      inject: [APP_CONFIG, NullPaymentProvider],
      useFactory: paymentProvider,
    },
    BillingIntentService,
    StripeWebhookService,
    DunningEvaluator,
    BillingSyncService,
    SyncStripeSeatsHandler,
    ReportStripeUsageHandler,
  ],
  exports: [
    PAYMENT_PROVIDER,
    BillingIntentService,
    BillingSyncService,
    SyncStripeSeatsHandler,
    ReportStripeUsageHandler,
  ],
})
export class PaymentsModule {}
