import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DataSource,
  type EntityManager,
  In,
  MoreThan,
  Not,
} from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { formatMailDate } from '#/core/mail/format-mail-date.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { BusinessMetrics } from '#/core/telemetry/business-metrics.js';
import { Company } from '#/database/entities/company.entity.js';
import { isUniqueViolation } from '#/database/pg-errors.js';
import { Invoice } from '#/billing/invoice.entity.js';
import { formatCents } from '#/billing/invoicing.service.js';
import { openPeriodAt } from '#/billing/period.js';
import { SubscriptionChange } from '#/subscriptions/subscription-change.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { BillingAccount } from './billing-account.entity.js';
import {
  PAYMENT_PROVIDER,
  type PaymentInvoice,
  type PaymentProvider,
  type PaymentSubscription,
  type VerifiedPaymentEvent,
} from './payment-provider.js';
import { StripeEvent } from './stripe-event.entity.js';
import { decideSubscriptionAction } from './subscription-adoption.js';

export interface StripeWebhookResult {
  duplicate: boolean;
  applied: boolean;
}

interface RetrievedObjects {
  subscription: PaymentSubscription | null;
  invoice: PaymentInvoice | null;
}

/**
 * Thrown when — and only when — inserting the event's own row hits its unique index: Stripe delivered this event before.
 * Any OTHER unique violation inside the transaction is a real failure and must surface (Stripe then retries), not be
 * mistaken for a duplicate and answered 200 with the event silently lost.
 */
class DuplicateStripeEvent extends Error {}

@Injectable()
export class StripeWebhookService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly metrics: BusinessMetrics,
    private readonly queue: TaskQueue,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async handle(
    rawBody: Buffer,
    signature: string,
  ): Promise<StripeWebhookResult> {
    let event: VerifiedPaymentEvent;
    try {
      event = this.provider.verifyWebhook(rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature.');
    }

    // A redelivery is answered before any Stripe API call is made for it. The unique index below stays the
    // authoritative guard: two concurrent deliveries of one event can both pass this read.
    const seen = await this.dataSource
      .getRepository(StripeEvent)
      .exists({ where: { stripeEventId: event.id } });
    if (seen) return { duplicate: true, applied: false };

    const retrieved = await this.retrieve(event);
    try {
      return await this.dataSource.transaction(async (manager) => {
        await this.recordEvent(manager, event);

        const account = event.customerId
          ? await manager.findOne(BillingAccount, {
              where: { stripeCustomerId: event.customerId },
              lock: { mode: 'pessimistic_write' },
            })
          : null;
        if (!account) return { duplicate: false, applied: false };

        return {
          duplicate: false,
          applied: await this.applyEvent(manager, account, event, retrieved),
        };
      });
    } catch (error) {
      if (error instanceof DuplicateStripeEvent)
        return { duplicate: true, applied: false };
      throw error;
    }
  }

  private async recordEvent(
    manager: EntityManager,
    event: VerifiedPaymentEvent,
  ): Promise<void> {
    try {
      await manager.insert(StripeEvent, {
        stripeEventId: event.id,
        type: event.type,
        stripeCreatedAt: event.createdAt,
        livemode: event.livemode,
        processedAt: this.clock.now(),
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateStripeEvent();
      throw error;
    }
  }

  /**
   * What one verified event does to the company. Which subscription it is about decides that, never the order Stripe
   * happened to deliver events in (`decideSubscriptionAction`); an invoice only counts when it belongs to a subscription
   * the company follows, so a stray second subscription can neither start a grace period nor mark anything paid.
   */
  private async applyEvent(
    manager: EntityManager,
    account: BillingAccount,
    event: VerifiedPaymentEvent,
    retrieved: RetrievedObjects,
  ): Promise<boolean> {
    let applied = false;
    let invoiceMayApply = true;

    if (retrieved.subscription) {
      const action = decideSubscriptionAction(
        { type: event.type, checkoutSessionId: event.checkoutSessionId },
        account,
        retrieved.subscription,
      );
      switch (action.kind) {
        case 'apply_paid':
          await this.applyPaid(
            manager,
            account,
            retrieved.subscription,
            action.status,
          );
          applied = true;
          break;
        case 'apply_free':
          await this.applyFree(manager, account);
          applied = true;
          break;
        case 'cancel':
          // Queued in THIS transaction: it commits with the event, and retries until Stripe accepts it.
          await this.queue.enqueue(
            'cancel_stripe_subscription',
            { subscriptionId: action.subscriptionId },
            { manager },
          );
          invoiceMayApply = false;
          break;
        case 'ignore':
          invoiceMayApply = false;
          break;
      }
    }

    if (retrieved.invoice && invoiceMayApply) {
      await this.applyInvoice(manager, account, retrieved.invoice, event.type);
      applied = true;
    }
    return applied;
  }

  private async retrieve(
    event: VerifiedPaymentEvent,
  ): Promise<RetrievedObjects> {
    const subscription = event.subscriptionId
      ? await this.provider.retrieveSubscription(event.subscriptionId)
      : null;
    const invoice = event.invoiceId
      ? await this.provider.retrieveInvoice(event.invoiceId)
      : null;
    return { subscription, invoice };
  }

  private async applyPaid(
    manager: EntityManager,
    account: BillingAccount,
    external: PaymentSubscription,
    status: 'current' | 'past_due',
  ): Promise<void> {
    let subscription = await manager.findOne(Subscription, {
      where: { companyId: account.companyId },
    });
    const previousPlan = subscription?.plan ?? null;
    if (!subscription) {
      subscription = manager.create(Subscription, {
        companyId: account.companyId,
        plan: external.plan,
        currentPeriodStart: external.periodStart,
        currentPeriodEnd: external.periodEnd,
        billingAnchorDay: external.periodStart.getUTCDate(),
      });
    } else {
      subscription.plan = external.plan;
      subscription.currentPeriodStart = external.periodStart;
      subscription.currentPeriodEnd = external.periodEnd;
      subscription.billingAnchorDay = external.periodStart.getUTCDate();
    }
    subscription = await manager.save(subscription);

    account.stripeSubscriptionId = external.id;
    account.stripeSeatItemId = external.seatItemId;
    if (status === 'past_due') {
      account.status = 'past_due';
      // The grace period starts when Stripe says payment stopped, even if the invoice event has not arrived yet.
      account.graceEndsAt ??= new Date(
        this.clock.now().getTime() +
          this.config.STRIPE_DUNNING_GRACE_DAYS * 86_400_000,
      );
    } else if (account.status !== 'past_due') {
      account.status = 'current';
    }
    // An account that is past due is brought back by a PAYMENT (`applyPayment`), which alone knows whether another
    // invoice is still overdue — never by a subscription refresh, which would erase the state that payment must see.
    account.pendingIntentId = null;
    account.pendingCheckoutSessionId = null;
    account.pendingPlan = null;
    account.pendingCreatedAt = null;
    await manager.save(account);

    if (previousPlan !== external.plan) {
      await manager.insert(SubscriptionChange, {
        companyId: account.companyId,
        fromPlan: previousPlan,
        toPlan: external.plan,
        effectiveAt: this.clock.now(),
        prorationCents: 0,
      });
      await this.audit.record(
        {
          action:
            previousPlan === null
              ? 'subscription.created'
              : 'subscription.changed',
          companyId: account.companyId,
          actorUserId: null,
          target: { type: 'subscription', id: subscription.id },
          metadata: {
            from: previousPlan,
            to: external.plan,
            provider: 'stripe',
          },
        },
        manager,
      );
      this.metrics.subscriptionChanged(external.plan);
    }
  }

  private async applyFree(
    manager: EntityManager,
    account: BillingAccount,
  ): Promise<void> {
    const now = this.clock.now();
    const { period, anchorDay } = openPeriodAt(now);
    let subscription = await manager.findOne(Subscription, {
      where: { companyId: account.companyId },
    });
    const previousPlan = subscription?.plan ?? null;
    if (!subscription) {
      subscription = manager.create(Subscription, {
        companyId: account.companyId,
        plan: 'free',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        billingAnchorDay: anchorDay,
      });
    } else {
      subscription.plan = 'free';
      subscription.currentPeriodStart = period.start;
      subscription.currentPeriodEnd = period.end;
      subscription.billingAnchorDay = anchorDay;
    }
    subscription = await manager.save(subscription);
    account.stripeSubscriptionId = null;
    account.stripeSeatItemId = null;
    account.status = 'cancelled';
    account.graceEndsAt = null;
    account.pendingIntentId = null;
    account.pendingCheckoutSessionId = null;
    account.pendingPlan = null;
    account.pendingCreatedAt = null;
    await manager.save(account);

    if (previousPlan !== 'free') {
      await manager.insert(SubscriptionChange, {
        companyId: account.companyId,
        fromPlan: previousPlan,
        toPlan: 'free',
        effectiveAt: now,
        prorationCents: 0,
      });
      await this.audit.record(
        {
          action:
            previousPlan === null
              ? 'subscription.created'
              : 'subscription.changed',
          companyId: account.companyId,
          actorUserId: null,
          target: { type: 'subscription', id: subscription.id },
          metadata: { from: previousPlan, to: 'free', provider: 'stripe' },
        },
        manager,
      );
      this.metrics.subscriptionChanged('free');
    }
  }

  /** Invoices Stripe has tried to collect at least once and still has not: what keeps a company suspended. */
  private hasOtherOverdueInvoices(
    manager: EntityManager,
    companyId: string,
    exceptInvoiceId: string,
  ): Promise<boolean> {
    return manager.getRepository(Invoice).exists({
      where: {
        companyId,
        provider: 'stripe',
        status: In(['open', 'uncollectible']),
        paymentAttempts: MoreThan(0),
        id: Not(exceptInvoiceId),
      },
    });
  }

  private async applyInvoice(
    manager: EntityManager,
    account: BillingAccount,
    external: PaymentInvoice,
    eventType: string,
  ): Promise<void> {
    const subscription = await manager.findOne(Subscription, {
      where: { companyId: account.companyId },
    });
    if (!subscription) return;
    let invoice = await manager.findOne(Invoice, {
      where: { stripeInvoiceId: external.id },
    });
    // What Gridline last knew: `invoice.paid` and `invoice.payment_succeeded` both fire for one payment, and it is
    // only the FIRST of them that is news.
    const previousStatus = invoice?.status ?? null;
    if (!invoice) {
      invoice = manager.create(Invoice, {
        companyId: account.companyId,
        plan: subscription.plan,
        periodStart: external.periodStart,
        periodEnd: external.periodEnd,
        lineItems: [],
        totalCents: external.totalCents,
        status: external.status,
        dueDate: external.dueAt ?? external.periodEnd,
        provider: 'stripe',
        stripeInvoiceId: external.id,
        stripeHostedInvoiceUrl: external.hostedUrl,
        stripeInvoicePdfUrl: external.pdfUrl,
        currency: external.currency,
        paymentAttempts: external.attempts,
        lastPaymentAttemptAt: external.attemptedAt,
        paidAt: external.paidAt,
      });
    } else {
      invoice.status = external.status;
      invoice.totalCents = external.totalCents;
      invoice.stripeHostedInvoiceUrl = external.hostedUrl;
      invoice.stripeInvoicePdfUrl = external.pdfUrl;
      invoice.paymentAttempts = external.attempts;
      invoice.lastPaymentAttemptAt = external.attemptedAt;
      invoice.paidAt = external.paidAt;
    }
    invoice = await manager.save(invoice);

    if (eventType === 'invoice.finalized') {
      const company = await manager.findOneByOrFail(Company, {
        id: account.companyId,
      });
      await this.audit.record(
        {
          action: 'billing.invoice_finalized',
          companyId: account.companyId,
          actorUserId: null,
          target: { type: 'invoice', id: invoice.id },
          metadata: {
            stripeInvoiceId: external.id,
            totalCents: external.totalCents,
          },
        },
        manager,
      );
      if (external.totalCents > 0) {
        await this.queue.enqueue(
          'send_email',
          {
            template: 'invoice_finalized',
            to: company.billingEmail,
            vars: {
              companyName: company.name,
              periodStart: formatMailDate(external.periodStart),
              periodEnd: formatMailDate(external.periodEnd),
              totalFormatted: formatCents(external.totalCents),
              invoiceUrl:
                external.hostedUrl ??
                `${this.config.APP_PUBLIC_URL}/billing`,
            },
          },
          { manager },
        );
      }
      this.metrics.invoiceFinalized(subscription.plan);
    }

    if (eventType === 'invoice.payment_failed') {
      account.status = 'past_due';
      account.graceEndsAt ??= new Date(
        this.clock.now().getTime() +
          this.config.STRIPE_DUNNING_GRACE_DAYS * 86_400_000,
      );
      await manager.save(account);
      await this.audit.record(
        {
          action: 'billing.payment_failed',
          companyId: account.companyId,
          actorUserId: null,
          target: { type: 'invoice', id: invoice.id },
          metadata: {
            stripeInvoiceId: external.id,
            graceEndsAt: account.graceEndsAt.toISOString(),
          },
        },
        manager,
      );
      const company = await manager.findOneByOrFail(Company, {
        id: account.companyId,
      });
      await this.queue.enqueue(
        'send_email',
        {
          template: 'payment_failed',
          to: company.billingEmail,
          vars: {
            companyName: company.name,
            totalFormatted: formatCents(external.totalCents),
            graceEndsAt: formatMailDate(account.graceEndsAt),
            billingUrl: `${this.config.APP_PUBLIC_URL}/billing`,
          },
        },
        { manager },
      );
    }
    if (
      eventType === 'invoice.payment_succeeded' ||
      eventType === 'invoice.paid'
    ) {
      await this.applyPayment(manager, account, invoice, previousStatus);
    }
  }

  /**
   * A payment went through. It is news — an audit entry, and "payment received" to the billing address — only when
   * it RECOVERS something: the account was past due or the company suspended. An ordinary renewal, or the first
   * payment at Checkout, is not a recovery and must not send one. Nothing is cleared while another invoice is
   * still overdue, and the same payment reported by two event types is handled once.
   */
  private async applyPayment(
    manager: EntityManager,
    account: BillingAccount,
    invoice: Invoice,
    previousStatus: Invoice['status'] | null,
  ): Promise<void> {
    const company = await manager.findOneByOrFail(Company, {
      id: account.companyId,
    });
    const wasPastDue = account.status === 'past_due';
    const wasSuspended = company.status === 'suspended';
    const firstReport = previousStatus !== 'paid';
    const stillOverdue = await this.hasOtherOverdueInvoices(
      manager,
      account.companyId,
      invoice.id,
    );

    if (wasPastDue && !stillOverdue) {
      account.status = 'current';
      account.graceEndsAt = null;
      await manager.save(account);
    }
    if (wasSuspended && !stillOverdue) {
      company.status = 'active';
      await manager.save(company);
      await this.audit.record(
        {
          action: 'billing.company_reactivated',
          companyId: account.companyId,
          actorUserId: null,
          target: { type: 'company', id: company.id },
        },
        manager,
      );
    }
    if (!firstReport) return;

    await this.audit.record(
      {
        action: 'billing.payment_succeeded',
        companyId: account.companyId,
        actorUserId: null,
        target: { type: 'invoice', id: invoice.id },
        metadata: { stripeInvoiceId: invoice.stripeInvoiceId },
      },
      manager,
    );
    if ((wasPastDue || wasSuspended) && !stillOverdue) {
      await this.queue.enqueue(
        'send_email',
        {
          template: 'payment_recovered',
          to: company.billingEmail,
          vars: {
            companyName: company.name,
            billingUrl: `${this.config.APP_PUBLIC_URL}/billing`,
          },
        },
        { manager },
      );
    }
  }
}
