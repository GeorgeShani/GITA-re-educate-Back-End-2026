import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { Company } from '#/database/entities/company.entity.js';
import type { Plan } from '#/subscriptions/plan-catalog.js';
import { NotificationsService } from './notifications.service.js';
import { describeQuotaAlert, nextPlanUp, thresholdsReached } from './quota-alert-rules.js';
import { QuotaAlert } from './quota-alert.entity.js';

const insertedRows = z.array(z.object({ id: z.uuid() }));

export interface QuotaUsage {
  companyId: string;
  plan: Plan;
  periodKey: string;
  periodEnd: Date;
  /** Files counted this period, INCLUDING the one just uploaded. */
  filesUsed: number;
  filesLimit: number;
}

/**
 * Tells a company, once per period per threshold, how much of its file quota is gone: an inbox entry
 * for every admin and an email to the billing address. Runs inside the upload transaction, right after
 * the file is counted, so the alert is written only if the upload commits.
 *
 * "Once" is the unique `(companyId, periodKey, threshold)` row: every upload past a threshold tries
 * to insert it, and only the insert that is not a conflict sends anything. The upload already holds
 * the subscription row lock, so uploads for one company never race here — the constraint is the
 * backstop that keeps it true if that ever changes, and a new period starts from a fresh key.
 */
@Injectable()
export class QuotaAlertsService {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly queue: TaskQueue,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async check(manager: EntityManager, usage: QuotaUsage): Promise<void> {
    for (const threshold of thresholdsReached(usage.filesUsed, usage.filesLimit)) {
      const inserted = insertedRows.parse(
        (
          await manager
            .createQueryBuilder()
            .insert()
            .into(QuotaAlert)
            .values({ companyId: usage.companyId, periodKey: usage.periodKey, threshold })
            .orIgnore()
            .returning('id')
            .execute()
        ).raw,
      );
      if (inserted.length === 0) continue; // already announced this period

      await this.announce(manager, usage, threshold);
    }
  }

  private async announce(manager: EntityManager, usage: QuotaUsage, threshold: 80 | 100): Promise<void> {
    const { companyId, plan, periodKey, filesUsed, filesLimit } = usage;

    await this.notifications.notifyAdmins(manager, companyId, {
      type: 'quota.threshold',
      payload: { threshold, plan, periodKey, filesUsed, filesLimit, upgradeTo: nextPlanUp(plan) },
    });

    const company = await manager.findOneOrFail(Company, { where: { id: companyId } });
    const text = describeQuotaAlert({
      plan,
      threshold,
      filesUsed,
      filesLimit,
      resetsOn: usage.periodEnd.toISOString().slice(0, 10),
    });
    await this.queue.enqueue(
      'send_email',
      {
        template: 'quota_threshold',
        to: company.billingEmail,
        vars: {
          companyName: company.name,
          threshold,
          headline: text.headline,
          detail: text.detail,
          billingUrl: new URL('/billing', this.config.APP_PUBLIC_URL).toString(),
        },
      },
      { manager },
    );
  }
}
