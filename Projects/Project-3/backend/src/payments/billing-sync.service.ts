import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { User } from '#/database/entities/user.entity.js';
import type { Plan } from '#/subscriptions/plan-catalog.js';
import { BillingAccount } from './billing-account.entity.js';
import { SeatSync } from './seat-sync.entity.js';

@Injectable()
export class BillingSyncService {
  constructor(private readonly queue: TaskQueue) {}

  async recordSeatChange(
    manager: EntityManager,
    companyId: string,
    effectiveAt: Date,
  ): Promise<void> {
    const account = await manager.findOne(BillingAccount, {
      where: { companyId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!account?.stripeSubscriptionId) return;

    const activeEmployees = await manager.getRepository(User).count({
      where: { companyId, role: 'employee', status: 'active' },
    });
    account.seatRevision += 1;
    await manager.save(account);
    await manager.insert(SeatSync, {
      companyId,
      sequence: account.seatRevision,
      activeEmployees,
      effectiveAt,
      status: 'pending',
      deliveredAt: null,
    });
    await this.queue.enqueue('sync_stripe_seats', { companyId }, { manager });
  }

  async recordUsage(manager: EntityManager, usageEvent: UsageEvent, plan: Plan): Promise<void> {
    if (plan !== 'premium') return;
    const account = await manager.findOneBy(BillingAccount, { companyId: usageEvent.companyId });
    if (!account?.stripeCustomerId || !account.stripeSubscriptionId) return;
    await this.queue.enqueue(
      'report_stripe_usage',
      { usageEventId: usageEvent.id },
      { manager },
    );
  }
}
