import { randomUUID } from 'node:crypto';
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
} from '#/payments/payment-provider.js';

export class FakePaymentProvider implements PaymentProvider {
  readonly checkouts: CheckoutRequest[] = [];
  readonly expiredSessions: string[] = [];
  readonly changes: SubscriptionChangeRequest[] = [];
  readonly cancellations: SubscriptionCancellationRequest[] = [];
  readonly seatUpdates: SeatQuantityRequest[] = [];
  readonly meterEvents: MeterEventRequest[] = [];
  readonly subscriptions = new Map<string, PaymentSubscription>();
  readonly invoices = new Map<string, PaymentInvoice>();
  private readonly webhookEvents = new Map<string, VerifiedPaymentEvent>();

  constructor(readonly enabled: boolean) {}

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    this.checkouts.push(request);
    return {
      customerId: request.customerId ?? `cus_${randomUUID()}`,
      sessionId: `cs_${randomUUID()}`,
      url: `https://checkout.stripe.test/${request.intentId}`,
    };
  }

  async expireCheckout(sessionId: string): Promise<void> {
    this.expiredSessions.push(sessionId);
  }

  async changeSubscription(request: SubscriptionChangeRequest): Promise<void> {
    this.changes.push(request);
  }

  async cancelSubscription(request: SubscriptionCancellationRequest): Promise<void> {
    this.cancellations.push(request);
  }

  async createPortalSession(customerId: string): Promise<string> {
    return `https://billing.stripe.test/${customerId}`;
  }

  async retrieveSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) throw new Error(`Unknown fake subscription ${subscriptionId}`);
    return subscription;
  }

  async retrieveInvoice(invoiceId: string): Promise<PaymentInvoice> {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) throw new Error(`Unknown fake invoice ${invoiceId}`);
    return invoice;
  }

  async syncSeatQuantity(request: SeatQuantityRequest): Promise<void> {
    this.seatUpdates.push(request);
  }

  async reportUsage(request: MeterEventRequest): Promise<void> {
    this.meterEvents.push(request);
  }

  verifyWebhook(rawBody: Buffer, signature: string): VerifiedPaymentEvent {
    if (signature !== 'valid') throw new Error('Invalid fake Stripe signature');
    const event = this.webhookEvents.get(rawBody.toString('utf8'));
    if (!event) throw new Error('Unknown fake Stripe event');
    return event;
  }

  issueWebhook(event: VerifiedPaymentEvent): Buffer {
    const key = randomUUID();
    const body = JSON.stringify({ key });
    this.webhookEvents.set(body, event);
    return Buffer.from(body);
  }

  reset(): void {
    this.checkouts.length = 0;
    this.expiredSessions.length = 0;
    this.changes.length = 0;
    this.cancellations.length = 0;
    this.seatUpdates.length = 0;
    this.meterEvents.length = 0;
    this.subscriptions.clear();
    this.invoices.clear();
    this.webhookEvents.clear();
  }
}
