import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

import type {
  CreatePaymentIntentParams,
  PaymentIntentResult,
  PaymentProvider,
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
}
