import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type {
  CheckoutRequest,
  CheckoutResult,
  MeterEventRequest,
  PaymentInvoice,
  PaymentProvider,
  PaymentSubscription,
  SeatQuantityRequest,
  SubscriptionCancellationRequest,
  SubscriptionChangeRequest,
  VerifiedPaymentEvent,
} from './payment-provider.js';

@Injectable()
export class NullPaymentProvider implements PaymentProvider {
  readonly enabled = false;

  private unavailable(): never {
    throw new ServiceUnavailableException('Paid subscriptions are not configured in this environment.');
  }

  createCheckout(_request: CheckoutRequest): Promise<CheckoutResult> {
    return Promise.reject(this.unavailable());
  }

  expireCheckout(_sessionId: string): Promise<void> {
    return Promise.reject(this.unavailable());
  }

  changeSubscription(_request: SubscriptionChangeRequest): Promise<void> {
    return Promise.reject(this.unavailable());
  }

  cancelSubscription(_request: SubscriptionCancellationRequest): Promise<void> {
    return Promise.reject(this.unavailable());
  }

  createPortalSession(_customerId: string): Promise<string> {
    return Promise.reject(this.unavailable());
  }

  retrieveSubscription(_subscriptionId: string): Promise<PaymentSubscription> {
    return Promise.reject(this.unavailable());
  }

  retrieveInvoice(_invoiceId: string): Promise<PaymentInvoice> {
    return Promise.reject(this.unavailable());
  }

  syncSeatQuantity(_request: SeatQuantityRequest): Promise<void> {
    return Promise.reject(this.unavailable());
  }

  reportUsage(_request: MeterEventRequest): Promise<void> {
    return Promise.reject(this.unavailable());
  }

  verifyWebhook(_rawBody: Buffer, _signature: string): VerifiedPaymentEvent {
    return this.unavailable();
  }
}
