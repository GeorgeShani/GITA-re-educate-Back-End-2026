import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { TenantScope } from '#/database/tenant-scope.js';
import { UsageEvent } from './usage-event.entity.js';

@Injectable()
export class UsageService {
  constructor(private readonly tenantScope: TenantScope) {}

  /** Files uploaded in the billing period whose start date is `periodKey`. */
  filesInPeriod(manager: EntityManager, companyId: string, periodKey: string): Promise<number> {
    return this.tenantScope
      .forCompany(manager.getRepository(UsageEvent), companyId, 'usage')
      .andWhere('usage.periodKey = :periodKey', { periodKey })
      .getCount();
  }
}
