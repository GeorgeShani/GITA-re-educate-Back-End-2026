import '../../load-env.js'; // MUST be the first import — see load-env.ts
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { AppConfigModule } from '../../config/config.module.js';
import { AuditModule } from '../../core/audit/audit.module.js';
import { CoreModule } from '../../core/core.module.js';
import { TasksModule } from '../../core/tasks/tasks.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { BillingCycleModule } from './billing-cycle.module.js';
import { BillingCycleService } from './billing-cycle.service.js';

/**
 * `npm run billing:run-cycle` → `node dist/billing/cycle/run-cycle.js`.
 *
 * The same job the scheduler runs daily, on demand — for an operator, or to catch up
 * after downtime. A standalone application context: no HTTP, no task runner, no schedule
 * (so nothing else fires while it works). Invoice emails are QUEUED here and sent by the
 * running API's task runner. Idempotent: running it twice bills nothing twice.
 */
@Module({
  imports: [
    AppConfigModule,
    ClsModule.forRoot({ global: true }),
    CoreModule,
    DatabaseModule,
    AuditModule,
    TasksModule,
    BillingCycleModule,
  ],
})
class BillingCycleCliModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(BillingCycleCliModule, {
    logger: ['error', 'warn'],
  });
  try {
    const result = await app.get(BillingCycleService).runCycle();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.failures > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

await main();
