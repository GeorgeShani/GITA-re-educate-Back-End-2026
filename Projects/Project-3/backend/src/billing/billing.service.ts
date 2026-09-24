import { HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { OffsetPage } from '#/common/pagination/paginated-result.js';
import { toOffsetPage } from '#/common/pagination/paginate.js';
import type { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { User } from '#/database/entities/user.entity.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import type { LineItem } from './calculator.js';
import { Invoice } from './invoice.entity.js';
import { type Period, daysIn, effectivePeriod, periodKey } from './period.js';
import { StatementService } from './statement.service.js';
import { UsageService } from './usage.service.js';

export interface StatementView {
  plan: Subscription['plan'];
  period: Period & { days: number };
  lineItems: LineItem[];
  totalCents: number;
  seats: number;
  filesThisPeriod: number;
  dueDate: Date;
  asOf: Date;
}

const NO_PLAN = 'No plan selected yet. Choose one with POST /subscriptions/me to use this feature.';

/**
 * The admin's window onto billing. Everything here is a READ: the running statement is
 * computed on demand by the same calculator that finalizes invoices, so what an admin
 * sees mid-period is what they will be invoiced (absent changes) — there is no second
 * implementation to drift. Writing invoices is `InvoicingService` / the rollover.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly statements: StatementService,
    private readonly usage: UsageService,
    private readonly context: RequestContextService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * The running bill for the period we are in NOW. If the daily job has not yet rolled a
   * finished period over, the period containing today is priced anyway (`effectivePeriod`)
   * rather than a stale one — and nothing is written to do it.
   *
   * Employees active now are projected active to the period's end: this is "what the
   * invoice will be if nothing changes", which is what a running total is for.
   */
  async currentStatement(): Promise<StatementView> {
    const companyId = this.context.requireCompanyId();
    const manager = this.dataSource.manager;

    const subscription = await this.tenantScope
      .forCompany(manager.getRepository(Subscription), companyId, 'sub')
      .getOne();
    if (!subscription) throw new HttpException(NO_PLAN, HttpStatus.PAYMENT_REQUIRED);

    const now = this.clock.now();
    const period = effectivePeriod(
      subscription.billingAnchorDay,
      { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd },
      now,
    );

    const [statement, filesThisPeriod, activeEmployees] = await Promise.all([
      this.statements.buildForPeriod(manager, subscription, period),
      this.usage.filesInPeriod(manager, companyId, periodKey(period)),
      this.tenantScope
        .forCompany(manager.getRepository(User), companyId, 'u')
        .andWhere("u.role = 'employee' AND u.status = 'active'")
        .getCount(),
    ]);

    return {
      plan: subscription.plan,
      period: { ...period, days: daysIn(period) },
      lineItems: statement.lineItems,
      totalCents: statement.totalCents,
      // The admin's seat is free but is still a seat (seats = admin + employees, D2).
      seats: activeEmployees + 1,
      filesThisPeriod,
      dueDate: period.end,
      asOf: now,
    };
  }

  /** Newest period first. */
  async listInvoices(query: OffsetQueryDto): Promise<OffsetPage<Invoice>> {
    const companyId = this.context.requireCompanyId();

    const [rows, total] = await this.tenantScope
      .forCompany(this.dataSource.getRepository(Invoice), companyId, 'inv')
      .orderBy('inv.periodStart', 'DESC')
      .addOrderBy('inv.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return toOffsetPage(rows, total, query.page, query.limit);
  }

  /** Another company's invoice is indistinguishable from one that does not exist. */
  async getInvoice(id: string): Promise<Invoice> {
    const invoice = await this.tenantScope
      .forCompany(this.dataSource.getRepository(Invoice), this.context.requireCompanyId(), 'inv')
      .andWhere('inv.id = :id', { id })
      .getOne();
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
}
