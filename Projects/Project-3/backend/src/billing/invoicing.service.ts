import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { Subscription } from '#/subscriptions/subscription.entity.js';
import { Invoice } from './invoice.entity.js';
import { nextPeriod, startOfUtcDay } from './period.js';
import { StatementService } from './statement.service.js';

/**
 * Turns a subscription's period into an `Invoice`. Two callers, one mechanism:
 * a plan change closes the period early, and the daily rollover (Phase 7)
 * closes it at its end. Both must run inside the caller's transaction, holding
 * the subscription row lock, so a period is invoiced exactly once.
 */
@Injectable()
export class InvoicingService {
  constructor(private readonly statements: StatementService) {}

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
    const start = subscription.currentPeriodStart;
    const end = new Date(
      Math.min(startOfUtcDay(closeAt).getTime(), subscription.currentPeriodEnd.getTime()),
    );
    if (end.getTime() <= start.getTime()) return null;

    const statement = await this.statements.build(
      manager,
      subscription,
      end.getTime() < subscription.currentPeriodEnd.getTime() ? end : undefined,
    );

    return manager.save(
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
    const invoices: Invoice[] = [];
    let advanced = false;

    while (subscription.currentPeriodEnd.getTime() <= now.getTime()) {
      const invoice = await this.closePeriod(manager, subscription, subscription.currentPeriodEnd);
      if (invoice) invoices.push(invoice);

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
