export interface CreatePaymentIntentParams {
  amountMinor: number;
  currency: string;
  /** Prevents a retried request from creating a second PaymentIntent for the same order attempt. */
  idempotencyKey: string;
  metadata: Record<string, string>;
}

export interface PaymentIntentResult {
  providerPaymentIntentId: string;
  clientSecret: string;
}

export interface WebhookEvent {
  type: string;
  paymentIntentId: string;
  amountMinor: number;
  failureReason?: string;
}

export interface SetupIntentResult {
  clientSecret: string;
}

export interface SavedPaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

// SCOPE.md Phase 4 — same provider-abstraction shape as MailProvider,
// StorageProvider, SearchProvider. StripePaymentProvider for real
// checkouts, MockPaymentProvider for offline dev — selected by
// PAYMENT_PROVIDER same way MAIL_PROVIDER selects the mail provider.
export interface PaymentProvider {
  createPaymentIntent(
    params: CreatePaymentIntentParams,
  ): Promise<PaymentIntentResult>;
  parseWebhookEvent(
    payload: string,
    signature: string | undefined,
  ): WebhookEvent;

  // Saved payment methods (S10) — a customer id is provider-scoped (a
  // Stripe Customer id here), created lazily via PaymentCustomerService
  // and cached on User.stripeCustomerId so it's never re-created per call.
  createCustomer(email: string): Promise<string>;
  createSetupIntent(customerId: string): Promise<SetupIntentResult>;
  listPaymentMethods(customerId: string): Promise<SavedPaymentMethod[]>;
  detachPaymentMethod(paymentMethodId: string): Promise<void>;
}

export const PAYMENT_PROVIDER_TOKEN = Symbol('PAYMENT_PROVIDER');
