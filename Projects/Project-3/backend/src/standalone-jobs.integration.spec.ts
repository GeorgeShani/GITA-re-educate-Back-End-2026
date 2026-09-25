import { Test } from '@nestjs/testing';
import { ClsModule } from 'nestjs-cls';
import { describe, expect, it } from 'vitest';
import { BillingCycleModule } from '#/billing/cycle/billing-cycle.module.js';
import { BillingCycleService } from '#/billing/cycle/billing-cycle.service.js';
import { AppConfigModule } from '#/config/config.module.js';
import { AiModule } from '#/core/ai/ai.module.js';
import { AuditModule } from '#/core/audit/audit.module.js';
import { CoreModule } from '#/core/core.module.js';
import { StorageModule } from '#/core/storage/storage.module.js';
import { TasksModule } from '#/core/tasks/tasks.module.js';
import { DatabaseModule } from '#/database/database.module.js';
import { DemoModule } from '#/demo/demo.module.js';
import { DemoSeedService } from '#/demo/demo-seed.service.js';

/**
 * The CLI jobs (`billing:run-cycle`, `seed:demo`, `seed:all`) boot a SMALL application context, not the
 * whole app. A provider that only `AppModule` supplies makes them fail at startup — which no other spec
 * sees, because every other spec boots `AppModule`. This builds the same module sets the CLIs use
 * (`run-cycle.ts`, `seed-demo.ts`, `seeds/seed-all.ts`) and proves each one resolves.
 */
describe('standalone job contexts (integration)', () => {
  it('the billing cycle job can be built without the rest of the app', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppConfigModule,
        ClsModule.forRoot({ global: true }),
        CoreModule,
        DatabaseModule,
        AuditModule,
        TasksModule,
        BillingCycleModule,
      ],
    }).compile();

    expect(moduleRef.get(BillingCycleService)).toBeDefined();
    await moduleRef.close();
  }, 60_000);

  it('the seed jobs can be built without the rest of the app', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AppConfigModule,
        ClsModule.forRoot({ global: true }),
        CoreModule,
        DatabaseModule,
        AuditModule,
        AiModule,
        StorageModule,
        TasksModule,
        DemoModule,
      ],
    }).compile();

    expect(moduleRef.get(DemoSeedService)).toBeDefined();
    await moduleRef.close();
  }, 60_000);
});
