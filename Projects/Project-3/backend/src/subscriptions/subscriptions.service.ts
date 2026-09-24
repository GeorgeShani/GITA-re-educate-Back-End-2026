import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { InvoicingService } from '#/billing/invoicing.service.js';
import { type Period, daysIn, openPeriodAt, periodKey, startOfUtcDay } from '#/billing/period.js';
import { UsageService } from '#/billing/usage.service.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { User } from '#/database/entities/user.entity.js';
import { isUniqueViolation } from '#/database/pg-errors.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { PLAN_CATALOG, type Plan, maxSeats } from './plan-catalog.js';
import { planChangeProblems } from './plan-change.js';
import { SubscriptionChange } from './subscription-change.entity.js';
import { Subscription } from './subscription.entity.js';

export interface SubscriptionView {
  plan: Plan;
  billingAnchorDay: number;
  period: Period & { key: string; days: number };
  limits: { maxEmployees: number | null; maxSeats: number | null; filesPerPeriod: number };
  usage: { files: number; employees: number; seats: number };
  nextDueDate: Date;
}

const NO_PLAN = 'No plan selected yet. Choose one with POST /subscriptions/me.';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly invoicing: InvoicingService,
    private readonly usage: UsageService,
    private readonly audit: AuditService,
    private readonly context: RequestContextService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  exists(companyId: string): Promise<boolean> {
    return this.tenantScope
      .forCompany(this.dataSource.getRepository(Subscription), companyId, 'sub')
      .getExists();
  }

  /**
   * The row, locked `FOR UPDATE` until the surrounding transaction ends. Every
   * writer of subscription state — plan change here, employee invites in Phase 4,
   * the rollover job in Phase 7 — takes this first, so they serialise per company
   * instead of interleaving.
   */
  lockForUpdate(manager: EntityManager, companyId: string): Promise<Subscription | null> {
    return this.tenantScope
      .forCompany(manager.getRepository(Subscription), companyId, 'sub')
      .setLock('pessimistic_write')
      .getOne();
  }

  /** Employees holding a seat: invited (holds one, bills $0) and active (D4). Disabled free theirs. */
  employeeSeatsHeld(manager: EntityManager, companyId: string): Promise<number> {
    return this.tenantScope
      .forCompany(manager.getRepository(User), companyId, 'u')
      .andWhere("u.role = 'employee'")
      .andWhere("u.status IN ('invited', 'active')")
      .getCount();
  }

  async view(manager: EntityManager = this.dataSource.manager): Promise<SubscriptionView> {
    const companyId = this.context.requireCompanyId();
    const subscription = await this.tenantScope
      .forCompany(manager.getRepository(Subscription), companyId, 'sub')
      .getOne();
    if (!subscription) throw new NotFoundException(NO_PLAN);

    return this.describe(manager, subscription);
  }

  /** The mandatory first choice after activation. Anchors billing to today (D6). */
  async choose(plan: Plan): Promise<SubscriptionView> {
    const companyId = this.context.requireCompanyId();
    const now = this.clock.now();
    const { period, anchorDay } = openPeriodAt(now);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const subscription = await manager.save(
          manager.create(Subscription, {
            companyId,
            plan,
            currentPeriodStart: period.start,
            currentPeriodEnd: period.end,
            billingAnchorDay: anchorDay,
          }),
        );
        await manager.insert(SubscriptionChange, {
          companyId,
          fromPlan: null,
          toPlan: plan,
          effectiveAt: now,
          prorationCents: 0,
        });
        await this.audit.record(
          {
            action: 'subscription.created',
            target: { type: 'subscription', id: subscription.id },
            metadata: { plan },
          },
          manager,
        );
        return this.describe(manager, subscription);
      });
    } catch (error) {
      // `companyId` is unique: the constraint, not a pre-check, settles a race.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'This company already has a plan. Change it with PATCH /subscriptions/me.',
        );
      }
      throw error;
    }
  }

  /**
   * Switches plan. A change *is* a new activation (D6): the outgoing period is
   * closed and invoiced for the days it ran, and a fresh period opens today,
   * anchored to today's day of the month.
   *
   * Everything happens under the subscription row lock, so two concurrent
   * changes run one after the other and each sees the other's result.
   */
  async change(
    target: Plan,
  ): Promise<{ view: SubscriptionView; previousPlan: Plan; prorationCents: number }> {
    const companyId = this.context.requireCompanyId();

    return this.dataSource.transaction(async (manager) => {
      const subscription = await this.lockForUpdate(manager, companyId);
      if (!subscription) throw new NotFoundException(NO_PLAN);
      if (subscription.plan === target) {
        throw new ConflictException(`This company is already on the ${target} plan.`);
      }

      const now = this.clock.now();
      // Bring the period up to date first, or days between it ending and the
      // daily job running would be dropped from billing.
      await this.invoicing.rollForward(manager, subscription, now);

      const problems = planChangeProblems(target, {
        employees: await this.employeeSeatsHeld(manager, companyId),
        files: await this.usage.filesInPeriod(
          manager,
          companyId,
          periodKey({ start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd }),
        ),
      });
      if (problems.length > 0) throw new ConflictException(problems);

      // The switch day belongs entirely to the incoming plan.
      const closingInvoice = await this.invoicing.closePeriod(
        manager,
        subscription,
        startOfUtcDay(now),
      );
      const prorationCents = closingInvoice?.totalCents ?? 0;

      const previousPlan = subscription.plan;
      const { period, anchorDay } = openPeriodAt(now);
      const updated = await manager
        .createQueryBuilder()
        .update(Subscription)
        .set({
          plan: target,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          billingAnchorDay: anchorDay,
          version: () => '"version" + 1',
        })
        // Defence in depth behind the row lock: if any path ever changed this row
        // without taking it, the version no longer matches and this writes nothing.
        .where('"id" = :id AND "version" = :version', {
          id: subscription.id,
          version: subscription.version,
        })
        .execute();
      if (!updated.affected) {
        throw new ConflictException('The subscription changed while this request ran. Try again.');
      }

      await manager.insert(SubscriptionChange, {
        companyId,
        fromPlan: previousPlan,
        toPlan: target,
        effectiveAt: now,
        prorationCents,
      });
      await this.audit.record(
        {
          action: 'subscription.changed',
          target: { type: 'subscription', id: subscription.id },
          metadata: { from: previousPlan, to: target, prorationCents },
        },
        manager,
      );

      const fresh = await manager.findOneOrFail(Subscription, { where: { id: subscription.id } });
      return { view: await this.describe(manager, fresh), previousPlan, prorationCents };
    });
  }

  private async describe(
    manager: EntityManager,
    subscription: Subscription,
  ): Promise<SubscriptionView> {
    const period: Period = {
      start: subscription.currentPeriodStart,
      end: subscription.currentPeriodEnd,
    };
    const rules = PLAN_CATALOG[subscription.plan];

    const [files, employees] = await Promise.all([
      this.usage.filesInPeriod(manager, subscription.companyId, periodKey(period)),
      this.employeeSeatsHeld(manager, subscription.companyId),
    ]);

    return {
      plan: subscription.plan,
      billingAnchorDay: subscription.billingAnchorDay,
      period: { ...period, key: periodKey(period), days: daysIn(period) },
      limits: {
        maxEmployees: rules.maxEmployees,
        maxSeats: maxSeats(subscription.plan),
        filesPerPeriod: rules.filesPerPeriod,
      },
      usage: { files, employees, seats: employees + 1 },
      nextDueDate: period.end,
    };
  }
}
