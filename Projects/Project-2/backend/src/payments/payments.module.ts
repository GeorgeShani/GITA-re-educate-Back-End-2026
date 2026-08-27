import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import Stripe from 'stripe';

import { CoreModule } from '../core/core.module';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { CreatePaymentIntentHandler } from './commands/handlers/create-payment-intent.handler';
import { RecordPaymentResultHandler } from './commands/handlers/record-payment-result.handler';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PAYMENT_PROVIDER_TOKEN } from './providers/payment-provider.interface';
import {
  STRIPE_CLIENT_TOKEN,
  StripePaymentProvider,
} from './providers/stripe-payment.provider';
import { PaymentsController } from './payments.controller';
import { Payment, PaymentSchema } from './schemas/payment.schema';
import { Refund, RefundSchema } from './schemas/refund.schema';

const COMMAND_HANDLERS = [
  CreatePaymentIntentHandler,
  RecordPaymentResultHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: Payment.name, schema: PaymentSchema },
      { name: Refund.name, schema: RefundSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [
    ...COMMAND_HANDLERS,
    {
      // Only constructed when PAYMENT_PROVIDER=stripe, matching
      // NotificationsModule's RESEND_CLIENT_TOKEN pattern — a dev/test
      // boot never needs a real STRIPE_SECRET_KEY.
      provide: STRIPE_CLIENT_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        if (configService.get<string>('PAYMENT_PROVIDER') !== 'stripe') {
          return undefined;
        }
        return new Stripe(
          configService.getOrThrow<string>('STRIPE_SECRET_KEY'),
        );
      },
    },
    {
      provide: PAYMENT_PROVIDER_TOKEN,
      inject: [ConfigService, StripePaymentProvider, MockPaymentProvider],
      useFactory: (
        configService: ConfigService,
        stripeProvider: StripePaymentProvider,
        mockProvider: MockPaymentProvider,
      ) =>
        configService.get<string>('PAYMENT_PROVIDER') === 'stripe'
          ? stripeProvider
          : mockProvider,
    },
    StripePaymentProvider,
    MockPaymentProvider,
  ],
  exports: [PAYMENT_PROVIDER_TOKEN],
})
export class PaymentsModule {}
