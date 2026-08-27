import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import type {
  PaymentIntentResult,
  PaymentProvider,
  RefundResult,
  SavedPaymentMethod,
  SetupIntentResult,
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

  createCustomer(): Promise<string> {
    return Promise.resolve(`mock_cus_${randomUUID()}`);
  }

  createSetupIntent(): Promise<SetupIntentResult> {
    return Promise.resolve({
      clientSecret: `mock_seti_secret_${randomUUID()}`,
    });
  }

  // No real card storage behind a mock customer id — dev/test callers
  // should expect an empty list rather than a fabricated card.
  listPaymentMethods(): Promise<SavedPaymentMethod[]> {
    return Promise.resolve([]);
  }

  detachPaymentMethod(): Promise<void> {
    return Promise.resolve();
  }

  createRefund(): Promise<RefundResult> {
    return Promise.resolve({ providerRefundId: `mock_re_${randomUUID()}` });
  }
}
