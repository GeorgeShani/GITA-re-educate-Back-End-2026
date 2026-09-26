import type { Plan } from '#/subscriptions/plan-catalog.js';

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export type PaidPlan = Exclude<Plan, 'free'>;

export interface CheckoutRequest {
  companyId: string;
  billingEmail: string;
  customerId?: string;
  plan: PaidPlan;
  activeEmployees: number;
  intentId: string;
}

export interface CheckoutResult {
  customerId: string;
  sessionId: string;
  url: string;
}

export interface SubscriptionChangeRequest {
  subscriptionId: string;
  targetPlan: PaidPlan;
  activeEmployees: number;
  effectiveAt: Date;
  idempotencyKey: string;
}

export interface SubscriptionCancellationRequest {
  subscriptionId: string;
  effectiveAt: Date;
  idempotencyKey: string;
}

export interface SeatQuantityRequest {
  subscriptionId: string;
  quantity: number;
  effectiveAt: Date;
  idempotencyKey: string;
}

export interface MeterEventRequest {
  customerId: string;
  usageEventId: string;
  occurredAt: Date;
}

export interface PaymentSubscription {
  id: string;
  customerId: string;
  plan: PaidPlan;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  seatItemId: string | null;
  latestInvoiceId: string | null;
}

export interface PaymentInvoice {
  id: string;
  customerId: string;
  subscriptionId: string | null;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  totalCents: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  dueAt: Date | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  attempts: number;
  attemptedAt: Date | null;
  paidAt: Date | null;
}

export interface VerifiedPaymentEvent {
  id: string;
  type: string;
  createdAt: Date;
  livemode: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  invoiceId: string | null;
  checkoutSessionId: string | null;
}

export interface PaymentProvider {
  readonly enabled: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutResult>;
  expireCheckout(sessionId: string): Promise<void>;
  changeSubscription(request: SubscriptionChangeRequest): Promise<void>;
  cancelSubscription(request: SubscriptionCancellationRequest): Promise<void>;
  createPortalSession(customerId: string): Promise<string>;
  retrieveSubscription(subscriptionId: string): Promise<PaymentSubscription>;
  retrieveInvoice(invoiceId: string): Promise<PaymentInvoice>;
  syncSeatQuantity(request: SeatQuantityRequest): Promise<void>;
  reportUsage(request: MeterEventRequest): Promise<void>;
  verifyWebhook(rawBody: Buffer, signature: string): VerifiedPaymentEvent;
}
