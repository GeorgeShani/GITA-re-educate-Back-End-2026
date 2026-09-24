import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { InvoicingService } from '#/billing/invoicing.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { SubscriptionsService } from '#/subscriptions/subscriptions.service.js';

export interface CycleResult {
  /** Subscriptions whose period had ended and were rolled forward. */
  companiesRolled: number;
  invoicesFinalized: number;
  /** Companies that failed and were skipped; the rest still ran. */
  failures: number;
}

/**
 * The billing cycle: for every subscription whose period has ended, invoice it and open
 * the next one. Run daily by `BillingCycleScheduler` and on demand by
 * `npm run billing:run-cycle`.
 *
 * Safe to run twice, concurrently, or from two instances:
 * - each company is handled in its OWN transaction holding the subscription row lock, so
 *   two runs serialise per company;
 * - after taking the lock the company is re-checked, so the second run finds its period
 *   already advanced and does nothing;
 * - `UNIQUE (companyId, periodStart)` on `invoice` is the backstop: a period can never be
 *   invoiced twice, whatever else goes wrong.
 *
 * One company failing must not stop the others being billed, so failures are logged and
 * counted, not thrown.
 */
@Injectable()
export class BillingCycleService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly subscriptions: SubscriptionsService,
    private readonly invoicing: InvoicingService,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.logger.setContext(BillingCycleService.name);
  }

  async runCycle(now: Date = this.clock.now()): Promise<CycleResult> {
    // A system job: it deliberately spans tenants, so it does not go through `TenantScope`.
    // Everything it WRITES is per-company, under that company's lock.
    const due = await this.dataSource.getRepository(Subscription).find({
      select: { id: true, companyId: true },
      where: { currentPeriodEnd: LessThanOrEqual(now) },
      order: { currentPeriodEnd: 'ASC', id: 'ASC' },
    });

    const result: CycleResult = { companiesRolled: 0, invoicesFinalized: 0, failures: 0 };
    for (const { companyId } of due) {
      try {
        const invoices = await this.rollCompany(companyId, now);
        if (invoices > 0) {
          result.companiesRolled += 1;
          result.invoicesFinalized += invoices;
        }
      } catch (error) {
        result.failures += 1;
        this.logger.error({ err: error, companyId }, 'Billing cycle failed for a company');
      }
    }
    return result;
  }

  private rollCompany(companyId: string, now: Date): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const subscription = await this.subscriptions.lockForUpdate(manager, companyId);
      // Re-check under the lock: another run may have rolled this one while we waited.
      if (!subscription || subscription.currentPeriodEnd.getTime() > now.getTime()) return 0;

      return (await this.invoicing.rollForward(manager, subscription, now)).length;
    });
  }
}
