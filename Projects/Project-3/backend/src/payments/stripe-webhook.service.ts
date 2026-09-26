import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
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

export interface StripeWebhookResult {
  duplicate: boolean;
  applied: boolean;
}

interface RetrievedObjects {
  subscription: PaymentSubscription | null;
  invoice: PaymentInvoice | null;
}

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

    const retrieved = await this.retrieve(event);
    let staleSubscriptionId: string | null = null;
    try {
      const result = await this.dataSource.transaction(async (manager) => {
        await manager.insert(StripeEvent, {
          stripeEventId: event.id,
          type: event.type,
          stripeCreatedAt: event.createdAt,
          livemode: event.livemode,
          processedAt: this.clock.now(),
        });

        const account = event.customerId
          ? await manager.findOne(BillingAccount, {
              where: { stripeCustomerId: event.customerId },
              lock: { mode: 'pessimistic_write' },
            })
          : null;
        if (!account) return { duplicate: false, applied: false };

        if (
          event.type === 'checkout.session.completed' &&
          event.checkoutSessionId !== account.pendingCheckoutSessionId
        ) {
          staleSubscriptionId = event.subscriptionId;
          return { duplicate: false, applied: false };
        }

        let applied = false;
        if (retrieved.subscription) {
          if (event.type === 'customer.subscription.deleted') {
            await this.applyFree(manager, account);
          } else {
            await this.applyPaid(manager, account, retrieved.subscription);
          }
          applied = true;
        }
        if (retrieved.invoice) {
          await this.applyInvoice(
            manager,
            account,
            retrieved.invoice,
            event.type,
          );
          applied = true;
        }
        return { duplicate: false, applied };
      });

      if (staleSubscriptionId) {
        await this.provider.cancelSubscription({
          subscriptionId: staleSubscriptionId,
          effectiveAt: this.clock.now(),
          idempotencyKey: `stale-checkout:${event.id}`,
        });
      }
      return result;
    } catch (error) {
      if (isUniqueViolation(error)) return { duplicate: true, applied: false };
      throw error;
    }
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
    account.status =
      external.status === 'past_due' || external.status === 'unpaid'
        ? 'past_due'
        : 'current';
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
              periodStart: external.periodStart.toISOString().slice(0, 10),
              periodEnd: external.periodEnd.toISOString().slice(0, 10),
              totalFormatted: formatCents(external.totalCents),
              invoiceUrl:
                external.hostedUrl ??
                `${this.config.APP_PUBLIC_URL}/settings/billing`,
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
            graceEndsAt: account.graceEndsAt.toISOString(),
            billingUrl: `${this.config.APP_PUBLIC_URL}/settings/billing`,
          },
        },
        { manager },
      );
    }
    if (
      eventType === 'invoice.payment_succeeded' ||
      eventType === 'invoice.paid'
    ) {
      account.status = 'current';
      account.graceEndsAt = null;
      await manager.save(account);
      const company = await manager.findOneByOrFail(Company, {
        id: account.companyId,
      });
      if (company.status === 'suspended') {
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
      await this.audit.record(
        {
          action: 'billing.payment_succeeded',
          companyId: account.companyId,
          actorUserId: null,
          target: { type: 'invoice', id: invoice.id },
          metadata: { stripeInvoiceId: external.id },
        },
        manager,
      );
      await this.queue.enqueue(
        'send_email',
        {
          template: 'payment_recovered',
          to: company.billingEmail,
          vars: {
            companyName: company.name,
            billingUrl: `${this.config.APP_PUBLIC_URL}/settings/billing`,
          },
        },
        { manager },
      );
    }
  }
}
