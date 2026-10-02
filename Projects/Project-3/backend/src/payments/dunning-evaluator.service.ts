import { Inject, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { Company } from '#/database/entities/company.entity.js';
import { BillingAccount } from './billing-account.entity.js';

@Injectable()
export class DunningEvaluator {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
    private readonly queue: TaskQueue,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @Cron('0 */15 * * * *')
  async evaluate(): Promise<number> {
    const overdue = await this.dataSource.getRepository(BillingAccount).find({
      where: { status: 'past_due', graceEndsAt: LessThanOrEqual(this.clock.now()) },
    });
    let suspended = 0;
    for (const account of overdue) {
      suspended += await this.dataSource.transaction(async (manager) => {
        const company = await manager.findOne(Company, {
          where: { id: account.companyId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!company || company.status !== 'active') return 0;
        const fresh = await manager.findOneByOrFail(BillingAccount, { id: account.id });
        if (fresh.status !== 'past_due' || !fresh.graceEndsAt || fresh.graceEndsAt > this.clock.now()) {
          return 0;
        }
        company.status = 'suspended';
        await manager.save(company);
        await this.audit.record(
          {
            action: 'billing.company_suspended',
            companyId: company.id,
            actorUserId: null,
            target: { type: 'company', id: company.id },
          },
          manager,
        );
        // Everyone is locked out from now on, so the one address that can fix it must be told, in the same step.
        await this.queue.enqueue(
          'send_email',
          {
            template: 'company_suspended',
            to: company.billingEmail,
            vars: {
              companyName: company.name,
              billingUrl: `${this.config.APP_PUBLIC_URL}/billing`,
            },
          },
          { manager },
        );
        return 1;
      });
    }
    return suspended;
  }
}
