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

  /** The bill for `subscription`'s stored period, optionally cut short at `upTo`. */
  build(manager: EntityManager, subscription: Subscription, upTo?: Date): Promise<Statement> {
    return this.buildForPeriod(
      manager,
      subscription,
      { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd },
      upTo,
    );
  }

  /**
   * The bill for an explicit `period` of a company on `plan`. Separate from `build` so a
   * read can price the period we are really in (`effectivePeriod`) without touching the
   * stored subscription.
   */
  async buildForPeriod(
    manager: EntityManager,
    subject: { companyId: string; plan: Subscription['plan'] },
    period: Period,
    upTo?: Date,
  ): Promise<Statement> {
    const [seatIntervals, filesThisPeriod] = await Promise.all([
      this.seatIntervals(manager, subject.companyId, period),
      this.usage.filesInPeriod(manager, subject.companyId, periodKey(period)),
    ]);

    return computeLineItems({
      plan: subject.plan,
      period,
      seatIntervals,
      filesThisPeriod,
      ...(upTo ? { upTo } : {}),
    });
  }
}
