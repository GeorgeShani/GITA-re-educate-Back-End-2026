import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  PaymentIntentResult,
  PaymentProvider,
  WebhookEvent,
} from './payment-provider.interface';

// PAYMENT_PROVIDER=mock — for offline dev with no Stripe test keys.
// createPaymentIntent works standalone; there's no real webhook to fire
// afterward, so PaymentsController exposes a dev-only endpoint
// (POST /payments/mock/:id/succeed|fail) that calls the exact same
// confirm/cancel path a real Stripe webhook would, letting the full
// checkout saga — stock decrement, coupon redemption, order
// confirmation — be exercised without a Stripe account.
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  createPaymentIntent(): Promise<PaymentIntentResult> {
    return Promise.resolve({
      providerPaymentIntentId: `mock_pi_${randomUUID()}`,
      clientSecret: `mock_pi_secret_${randomUUID()}`,
    });
  }

  parseWebhookEvent(): WebhookEvent {
    throw new Error(
      'MockPaymentProvider has no real webhooks — use POST /payments/mock/:id/succeed|fail instead',
    );
  }
}
