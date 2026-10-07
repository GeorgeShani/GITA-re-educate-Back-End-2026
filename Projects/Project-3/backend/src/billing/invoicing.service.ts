import { Inject, Injectable } from '@nestjs/common';
import { type EntityManager, IsNull, Not } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { formatMailDate } from '#/core/mail/format-mail-date.js';
import { BusinessMetrics } from '#/core/telemetry/business-metrics.js';
import { NotificationsService } from '#/notifications/notifications.service.js';
import { WebhookPublisher } from '#/outgoing-webhooks/webhook-publisher.service.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { Company } from '#/database/entities/company.entity.js';
import { BillingAccount } from '#/payments/billing-account.entity.js';
import type { Subscription } from '#/subscriptions/subscription.entity.js';
import { Invoice } from './invoice.entity.js';
import { nextPeriod, startOfUtcDay } from './period.js';
import { StatementService } from './statement.service.js';

/** `12345` → `$123.45`. Integer maths only; cents never pass through a float. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100).toLocaleString('en-US')}.${String(abs % 100).padStart(2, '0')}`;
}

/**
 * Turns a subscription's period into an `Invoice`. Two callers, one mechanism:
 * a plan change closes the period early, and the daily rollover (Phase 7)
 * closes it at its end. Both must run inside the caller's transaction, holding
 * the subscription row lock, so a period is invoiced exactly once.
 */
@Injectable()
export class InvoicingService {
  constructor(
    private readonly statements: StatementService,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    private readonly metrics: BusinessMetrics,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhookPublisher,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * Invoices `[currentPeriodStart, closeAt)` — or the whole period if `closeAt`
   * reaches its end. Returns `null`, writing nothing, when that range is empty
   * (a plan change on the period's first day has nothing yet to bill).
   */
  async closePeriod(
    manager: EntityManager,
    subscription: Subscription,
    closeAt: Date,
  ): Promise<Invoice | null> {
    // Stripe collects for a company on a Stripe subscription, so a local invoice would be a second, uncollectable one.
    if (await this.isStripeManaged(manager, subscription.companyId)) return null;
    const start = subscription.currentPeriodStart;
    const end = new Date(
      Math.min(
        startOfUtcDay(closeAt).getTime(),
        subscription.currentPeriodEnd.getTime(),
      ),
    );
    if (end.getTime() <= start.getTime()) return null;

    const statement = await this.statements.build(
      manager,
      subscription,
      end.getTime() < subscription.currentPeriodEnd.getTime() ? end : undefined,
    );

    const invoice = await manager.save(
      manager.create(Invoice, {
        companyId: subscription.companyId,
        plan: subscription.plan,
        periodStart: start,
        periodEnd: end,
        lineItems: statement.lineItems,
        totalCents: statement.totalCents,
        status: 'finalized',
        dueDate: end,
      }),
    );
    await this.announce(manager, invoice);
    return invoice;
  }

  /**
   * Every invoice is announced from the one place they are created, so the daily
   * rollover, a plan change and an upload that rolls the period forward all behave
   * the same: an audit entry, and — when there is something to pay — an email to the
   * company's billing address. Both commit or roll back with the invoice itself.
   * A $0 invoice (Free, or an idle Premium-less period) is audited but neither emailed nor
   * put in an inbox: nobody wants a monthly "your invoice is $0.00".
   */
  private async announce(
    manager: EntityManager,
    invoice: Invoice,
  ): Promise<void> {
    await this.audit.record(
      {
        action: 'billing.invoice_finalized',
        companyId: invoice.companyId,
        target: { type: 'invoice', id: invoice.id },
        metadata: {
          plan: invoice.plan,
          periodStart: invoice.periodStart.toISOString(),
          totalCents: invoice.totalCents,
        },
      },
      manager,
    );
    // Counted where invoices are made, so the rollover, a plan change and an upload that rolls the
    // period forward all show up. (It happens inside the caller's transaction; a rollback after this
    // point would over-count by one, which a counter can tolerate and a later invoice corrects.)
    this.metrics.invoiceFinalized(invoice.plan);
    await this.webhooks.publish(
      manager,
      invoice.companyId,
      'invoice.finalized',
      {
        invoiceId: invoice.id,
        totalCents: invoice.totalCents,
        periodStart: invoice.periodStart.toISOString(),
        periodEnd: invoice.periodEnd.toISOString(),
      },
    );
    if (invoice.totalCents <= 0) return;

    await this.notifications.notifyAdmins(manager, invoice.companyId, {
      type: 'invoice.finalized',
      payload: {
        invoiceId: invoice.id,
        totalCents: invoice.totalCents,
        periodStart: invoice.periodStart.toISOString().slice(0, 10),
        periodEnd: invoice.periodEnd.toISOString().slice(0, 10),
      },
    });

    const company = await manager.findOneOrFail(Company, {
      where: { id: invoice.companyId },
    });
    await this.queue.enqueue(
      'send_email',
      {
        template: 'invoice_finalized',
        to: company.billingEmail,
        vars: {
          companyName: company.name,
          periodStart: formatMailDate(invoice.periodStart),
          periodEnd: formatMailDate(invoice.periodEnd),
          totalFormatted: formatCents(invoice.totalCents),
          invoiceUrl: new URL(
            `/billing/invoices/${invoice.id}`,
            this.config.APP_PUBLIC_URL,
          ).toString(),
        },
      },
      { manager },
    );
  }

  /** A company whose paid plan follows a Stripe subscription: its periods, invoices and payments belong to Stripe. */
  isStripeManaged(manager: EntityManager, companyId: string): Promise<boolean> {
    return manager
      .getRepository(BillingAccount)
      .exists({ where: { companyId, stripeSubscriptionId: Not(IsNull()) } });
  }

  /**
   * Invoices and steps past every period that has already ended by `now`, one at
   * a time, leaving `subscription` on the period that contains `now`. Called
   * before anything that assumes the current period is current — otherwise a
   * plan change landing between a period ending and the daily job running would
   * silently drop the elapsed days from billing.
   */
  async rollForward(
    manager: EntityManager,
    subscription: Subscription,
    now: Date,
  ): Promise<Invoice[]> {
    // The invoices of a Stripe-managed company are Stripe's: this loop must never invent one, nor the email and
    // `invoice.finalized` event that go with it. But the WINDOW still has to move with time. Stripe's renewal webhook can be
    // late, and until it lands a stored period that has already ended would count today's uploads against the old one (a
    // Basic company turned away at its quota, Premium overage counted in the wrong period). The webhook overwrites the
    // window with Stripe's own dates when it arrives.
    const stripeManaged = await this.isStripeManaged(manager, subscription.companyId);
    const invoices: Invoice[] = [];
    let advanced = false;

    while (subscription.currentPeriodEnd.getTime() <= now.getTime()) {
      if (!stripeManaged) {
        const invoice = await this.closePeriod(
          manager,
          subscription,
          subscription.currentPeriodEnd,
        );
        if (invoice) invoices.push(invoice);
      }

      const following = nextPeriod(subscription.billingAnchorDay, {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd,
      });
      subscription.currentPeriodStart = following.start;
      subscription.currentPeriodEnd = following.end;
      advanced = true;
    }

    if (advanced) await manager.save(subscription);
    return invoices;
  }
}
