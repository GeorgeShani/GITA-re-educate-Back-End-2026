import Stripe from 'stripe';
import { z } from 'zod';
import type {
  CheckoutRequest,
  CheckoutResult,
  MeterEventRequest,
  PaidPlan,
  PaymentInvoice,
  PaymentProvider,
  PaymentSubscription,
  SeatQuantityRequest,
  SubscriptionCancellationRequest,
  SubscriptionChangeRequest,
  VerifiedPaymentEvent,
} from './payment-provider.js';

export interface StripePaymentConfig {
  secretKey: string;
  webhookSecret: string;
  basicBasePriceId: string;
  basicSeatPriceId: string;
  premiumBasePriceId: string;
  premiumOveragePriceId: string;
  meterEventName: string;
  portalConfigurationId: string;
  appPublicUrl: string;
}

const invoiceStatusSchema = z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']);
const verifiedEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    created: z.number().int().nonnegative(),
    livemode: z.boolean(),
  })
  .passthrough();
const eventObjectSchema = z
  .object({
    id: z.string().min(1),
    object: z.string().min(1),
    customer: z.union([z.string(), z.object({ id: z.string() })]).nullable().optional(),
    subscription: z.union([z.string(), z.object({ id: z.string() })]).nullable().optional(),
    parent: z
      .object({
        subscription_details: z
          .object({ subscription: z.union([z.string(), z.object({ id: z.string() })]) })
          .nullable(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

function idOf(value: { id: string } | string | null): string | null {
  if (typeof value === 'string' || value === null) return value;
  return value.id;
}

function unixDate(seconds: number): Date {
  return new Date(seconds * 1_000);
}

function firstItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem {
  const item = subscription.items.data[0];
  if (!item) throw new Error(`Stripe subscription ${subscription.id} has no items.`);
  return item;
}

export class StripePaymentProvider implements PaymentProvider {
  readonly enabled = true;
  private readonly stripe: Stripe;

  constructor(private readonly config: StripePaymentConfig) {
    this.stripe = new Stripe(config.secretKey);
  }

  async createCheckout(request: CheckoutRequest): Promise<CheckoutResult> {
    const customerId = request.customerId ?? (await this.createCustomer(request));
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: customerId,
        client_reference_id: request.intentId,
        payment_method_collection: 'always',
        line_items: this.lineItems(request.plan, request.activeEmployees),
        success_url: `${this.config.appPublicUrl}/settings/billing?checkout=success`,
        cancel_url: `${this.config.appPublicUrl}/settings/billing?checkout=cancelled`,
      },
      { idempotencyKey: `checkout:${request.intentId}` },
    );
    if (!session.url) throw new Error('Stripe did not return a Checkout URL.');
    return { customerId, sessionId: session.id, url: session.url };
  }

  async expireCheckout(sessionId: string): Promise<void> {
    await this.stripe.checkout.sessions.expire(sessionId);
  }

  async changeSubscription(request: SubscriptionChangeRequest): Promise<void> {
    const current = await this.stripe.subscriptions.retrieve(request.subscriptionId);
    const items: Stripe.SubscriptionUpdateParams.Item[] = current.items.data.map((item) => ({
      id: item.id,
      deleted: true,
    }));
    items.push(...this.updateItems(request.targetPlan, request.activeEmployees));
    await this.stripe.subscriptions.update(
      request.subscriptionId,
      {
        items,
        billing_cycle_anchor: 'now',
        proration_behavior: 'always_invoice',
        payment_behavior: 'pending_if_incomplete',
        proration_date: Math.floor(request.effectiveAt.getTime() / 1_000),
      },
      { idempotencyKey: request.idempotencyKey },
    );
  }

  async cancelSubscription(request: SubscriptionCancellationRequest): Promise<void> {
    await this.stripe.subscriptions.cancel(
      request.subscriptionId,
      { invoice_now: true, prorate: true },
      { idempotencyKey: request.idempotencyKey },
    );
  }

  async createPortalSession(customerId: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      configuration: this.config.portalConfigurationId,
      return_url: `${this.config.appPublicUrl}/settings/billing`,
    });
    return session.url;
  }

  async retrieveSubscription(subscriptionId: string): Promise<PaymentSubscription> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const item = firstItem(subscription);
    const customerId = idOf(subscription.customer);
    if (!customerId) throw new Error(`Stripe subscription ${subscription.id} has no customer.`);
    return {
      id: subscription.id,
      customerId,
      plan: this.planOf(subscription),
      status: subscription.status,
      periodStart: unixDate(item.current_period_start),
      periodEnd: unixDate(item.current_period_end),
      seatItemId:
        subscription.items.data.find((candidate) => candidate.price.id === this.config.basicSeatPriceId)?.id ?? null,
      latestInvoiceId: idOf(subscription.latest_invoice),
    };
  }

  async retrieveInvoice(invoiceId: string): Promise<PaymentInvoice> {
    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    const customerId = idOf(invoice.customer);
    if (!customerId) throw new Error(`Stripe invoice ${invoice.id} has no customer.`);
    const subscriptionId = idOf(invoice.parent?.subscription_details?.subscription ?? null);
    return {
      id: invoice.id,
      customerId,
      subscriptionId,
      status: invoiceStatusSchema.parse(invoice.status ?? 'draft'),
      totalCents: invoice.total,
      currency: invoice.currency,
      periodStart: unixDate(invoice.period_start),
      periodEnd: unixDate(invoice.period_end),
      dueAt: invoice.due_date === null ? null : unixDate(invoice.due_date),
      hostedUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
      attempts: invoice.attempt_count,
      attemptedAt: invoice.attempted ? unixDate(invoice.created) : null,
      paidAt:
        invoice.status_transitions.paid_at === null
          ? null
          : unixDate(invoice.status_transitions.paid_at),
    };
  }

  async syncSeatQuantity(request: SeatQuantityRequest): Promise<void> {
    const subscription = await this.stripe.subscriptions.retrieve(request.subscriptionId);
    const item = subscription.items.data.find(
      (candidate) => candidate.price.id === this.config.basicSeatPriceId,
    );
    if (!item) throw new Error(`Stripe subscription ${subscription.id} has no Basic seat item.`);
    await this.stripe.subscriptionItems.update(
      item.id,
      {
        quantity: request.quantity,
        proration_behavior: 'create_prorations',
        proration_date: Math.floor(request.effectiveAt.getTime() / 1_000),
      },
      { idempotencyKey: request.idempotencyKey },
    );
  }

  async reportUsage(request: MeterEventRequest): Promise<void> {
    await this.stripe.billing.meterEvents.create({
      event_name: this.config.meterEventName,
      identifier: request.usageEventId,
      timestamp: Math.floor(request.occurredAt.getTime() / 1_000),
      payload: { stripe_customer_id: request.customerId, value: '1' },
    });
  }

  verifyWebhook(rawBody: Buffer, signature: string): VerifiedPaymentEvent {
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.config.webhookSecret);
    const parsed = verifiedEventSchema.parse(event);
    const object = eventObjectSchema.parse(event.data.object);
    const customerId = idOf(object.customer ?? null);
    const directSubscriptionId = idOf(object.subscription ?? null);
    const parentSubscriptionId = idOf(object.parent?.subscription_details?.subscription ?? null);
    return {
      id: parsed.id,
      type: parsed.type,
      createdAt: unixDate(parsed.created),
      livemode: parsed.livemode,
      customerId,
      subscriptionId:
        object.object === 'subscription' ? object.id : (directSubscriptionId ?? parentSubscriptionId),
      invoiceId: object.object === 'invoice' ? object.id : null,
      checkoutSessionId: object.object === 'checkout.session' ? object.id : null,
    };
  }

  private async createCustomer(request: CheckoutRequest): Promise<string> {
    const customer = await this.stripe.customers.create(
      { email: request.billingEmail },
      { idempotencyKey: `customer:${request.companyId}` },
    );
    return customer.id;
  }

  private lineItems(plan: PaidPlan, activeEmployees: number): Stripe.Checkout.SessionCreateParams.LineItem[] {
    if (plan === 'basic') {
      return [
        { price: this.config.basicBasePriceId, quantity: 1 },
        { price: this.config.basicSeatPriceId, quantity: activeEmployees },
      ];
    }
    return [
      { price: this.config.premiumBasePriceId, quantity: 1 },
      { price: this.config.premiumOveragePriceId },
    ];
  }

  private updateItems(
    plan: PaidPlan,
    activeEmployees: number,
  ): Stripe.SubscriptionUpdateParams.Item[] {
    if (plan === 'basic') {
      return [
        { price: this.config.basicBasePriceId, quantity: 1 },
        { price: this.config.basicSeatPriceId, quantity: activeEmployees },
      ];
    }
    return [{ price: this.config.premiumBasePriceId, quantity: 1 }, { price: this.config.premiumOveragePriceId }];
  }

  private planOf(subscription: Stripe.Subscription): PaidPlan {
    const priceIds = new Set(subscription.items.data.map((item) => item.price.id));
    if (priceIds.has(this.config.basicBasePriceId)) return 'basic';
    if (priceIds.has(this.config.premiumBasePriceId)) return 'premium';
    throw new Error(`Stripe subscription ${subscription.id} uses an unknown price catalog.`);
  }
}
