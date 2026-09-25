import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { effectivePeriod, periodKey } from '#/billing/period.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import {
  type BurnDownPoint,
  type EmployeeActivity,
  type FilesPerDayPoint,
  type PlanChangeRecord,
  type StorageUsage,
  filesPerDay,
  planHistory,
  quotaBurnDown,
  storageUsage,
  uploadsByEmployee,
} from './analytics.queries.js';
import { type DayRange, resolveRange } from './usage-range.js';

export interface UsageAnalytics {
  range: DayRange;
  filesPerDay: FilesPerDayPoint[];
  byEmployee: EmployeeActivity[];
  storage: StorageUsage;
  quota: {
    plan: Subscription['plan'];
    limit: number;
    used: number;
    periodStart: Date;
    periodEnd: Date;
    points: BurnDownPoint[];
  };
  planHistory: PlanChangeRecord[];
}

const NO_PLAN = 'No plan selected yet. Choose one with POST /subscriptions/me to use this feature.';

/** Admin-only usage analytics for the caller's company. The numbers themselves are in `analytics.queries.ts`. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly context: RequestContextService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async usage(requested: { from?: Date | undefined; to?: Date | undefined }): Promise<UsageAnalytics> {
    const companyId = this.context.requireCompanyId();
    const manager = this.dataSource.manager;
    const now = this.clock.now();

    const subscription = await this.tenantScope
      .forCompany(manager.getRepository(Subscription), companyId, 'sub')
      .getOne();
    if (!subscription) throw new HttpException(NO_PLAN, HttpStatus.PAYMENT_REQUIRED);

    // The period we are actually in (the daily job may not have rolled a finished one yet).
    const period = effectivePeriod(
      subscription.billingAnchorDay,
      { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd },
      now,
    );
    const range = resolveRange(requested, period, now);
    const limit = PLAN_CATALOG[subscription.plan].filesPerPeriod;

    const [perDay, byEmployee, storage, points, history] = await Promise.all([
      filesPerDay(manager, companyId, range),
      uploadsByEmployee(manager, companyId, range),
      storageUsage(manager, companyId, range),
      quotaBurnDown(manager, companyId, { ...period, key: periodKey(period) }, limit, now),
      planHistory(manager, companyId),
    ]);

    return {
      range,
      filesPerDay: perDay,
      byEmployee,
      storage,
      quota: {
        plan: subscription.plan,
        limit,
        used: points.at(-1)?.used ?? 0,
        periodStart: period.start,
        periodEnd: period.end,
        points,
      },
      planHistory: history,
    };
  }
}
