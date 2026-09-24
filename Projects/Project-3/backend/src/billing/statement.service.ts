import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { TenantScope } from '#/database/tenant-scope.js';
import type { Subscription } from '#/subscriptions/subscription.entity.js';
import { type SeatInterval as CalculatorSeatInterval, type Statement, computeLineItems } from './calculator.js';
import { type Period, periodKey } from './period.js';
import { SeatInterval } from './seat-interval.entity.js';
import { UsageService } from './usage.service.js';

/**
 * Gathers what the calculator needs from the database and hands it to the pure
 * function. Deliberately thin: every rule lives in `calculator.ts`.
 */
@Injectable()
export class StatementService {
  constructor(
    private readonly tenantScope: TenantScope,
    private readonly usage: UsageService,
  ) {}

  /** Billable seat time overlapping `period`, in the calculator's shape. */
  async seatIntervals(
    manager: EntityManager,
    companyId: string,
    period: Period,
  ): Promise<CalculatorSeatInterval[]> {
    const rows = await this.tenantScope
      .forCompany(manager.getRepository(SeatInterval), companyId, 'seat')
      // Half-open overlap with [start, end): starts before it ends, ends after it starts.
      .andWhere('seat.activeFrom < :end', { end: period.end })
      .andWhere('(seat.activeTo IS NULL OR seat.activeTo > :start)', { start: period.start })
      .orderBy('seat.activeFrom', 'ASC')
      .addOrderBy('seat.id', 'ASC')
      .getMany();

    return rows.map((row) => ({ userId: row.userId, from: row.activeFrom, to: row.activeTo }));
  }

  /** The bill for `subscription`'s current period, optionally cut short at `upTo`. */
  async build(manager: EntityManager, subscription: Subscription, upTo?: Date): Promise<Statement> {
    const period: Period = {
      start: subscription.currentPeriodStart,
      end: subscription.currentPeriodEnd,
    };

    const [seatIntervals, filesThisPeriod] = await Promise.all([
      this.seatIntervals(manager, subscription.companyId, period),
      this.usage.filesInPeriod(manager, subscription.companyId, periodKey(period)),
    ]);

    return computeLineItems({
      plan: subscription.plan,
      period,
      seatIntervals,
      filesThisPeriod,
      ...(upTo ? { upTo } : {}),
    });
  }
}
