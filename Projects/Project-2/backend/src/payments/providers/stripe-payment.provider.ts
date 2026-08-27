import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import type {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentProvider,
  RefundResult,
  SavedPaymentMethod,
  SetupIntentResult,
  WebhookEvent,
} from './payment-provider.interface';

export const STRIPE_CLIENT_TOKEN = Symbol('STRIPE_CLIENT');

@Injectable()
export class StripePaymentProvider implements PaymentProvider {
  constructor(
    @Inject(STRIPE_CLIENT_TOKEN) private readonly client: Stripe,
    private readonly configService: ConfigService,
  ) {}

  async createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<PaymentIntentResult> {
    const intent = await this.client.paymentIntents.create(
      {
        amount: params.amountMinor,
        currency: params.currency,
        metadata: params.metadata,
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: params.idempotencyKey },
    );

    if (!intent.client_secret) {
      throw new Error(
        'Stripe did not return a client_secret for the created PaymentIntent',
      );
    }

    return {
      providerPaymentIntentId: intent.id,
      clientSecret: intent.client_secret,
    };
  }

  parseWebhookEvent(
    payload: string,
    signature: string | undefined,
  ): WebhookEvent {
    if (!signature) {
      throw new BadRequestException('Missing Stripe-Signature header');
    }

    const secret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );
    let event: Stripe.Event;
    try {
      event = this.client.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new BadRequestException(
        `Invalid Stripe webhook signature: ${message}`,
      );
    }

    const intent = event.data.object as Stripe.PaymentIntent;
    return {
      type: event.type,
      paymentIntentId: intent.id,
      amountMinor: intent.amount,
      failureReason: intent.last_payment_error?.message,
    };
  }

  async createCustomer(email: string): Promise<string> {
    const customer = await this.client.customers.create({ email });
    return customer.id;
  }

  async createSetupIntent(customerId: string): Promise<SetupIntentResult> {
    const intent = await this.client.setupIntents.create({
      customer: customerId,
      automatic_payment_methods: { enabled: true },
    });

    if (!intent.client_secret) {
      throw new Error(
        'Stripe did not return a client_secret for the created SetupIntent',
      );
    }

    return { clientSecret: intent.client_secret };
  }

  async listPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]> {
    const methods = await this.client.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    return methods.data
      .filter(
        (
          method,
        ): method is Stripe.PaymentMethod & {
          card: Stripe.PaymentMethod.Card;
        } => Boolean(method.card),
      )
      .map((method) => ({
        id: method.id,
        brand: method.card.brand,
        last4: method.card.last4,
        expMonth: method.card.exp_month,
        expYear: method.card.exp_year,
      }));
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.client.paymentMethods.detach(paymentMethodId);
  }

  async createRefund(
    providerPaymentIntentId: string,
    amountMinor: number,
    reason?: string,
  ): Promise<RefundResult> {
    const refund = await this.client.refunds.create({
      payment_intent: providerPaymentIntentId,
      amount: amountMinor,
      reason: reason ? 'requested_by_customer' : undefined,
      metadata: reason ? { reason } : undefined,
    });

    return { providerRefundId: refund.id };
  }
}
