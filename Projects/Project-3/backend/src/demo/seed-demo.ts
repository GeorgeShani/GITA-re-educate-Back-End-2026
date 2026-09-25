import '../load-env.js'; // MUST be the first import — see load-env.ts
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { AiModule } from '../core/ai/ai.module.js';
import { AppConfigModule } from '../config/config.module.js';
import { AuditModule } from '../core/audit/audit.module.js';
import { CoreModule } from '../core/core.module.js';
import { StorageModule } from '../core/storage/storage.module.js';
import { TasksModule } from '../core/tasks/tasks.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DemoModule } from './demo.module.js';
import { DemoSeedService } from './demo-seed.service.js';

/**
 * `npm run seed:demo` → `node dist/demo/seed-demo.js`.
 *
 * Creates the read-only demo company if it does not exist yet (safe to run on every deploy).
 * A standalone application context: no HTTP, no task runner. The files it writes go to the
 * configured storage driver, so run it with the same STORAGE_* settings as the API.
 */
@Module({
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
})
class SeedDemoCliModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedDemoCliModule, { logger: ['error', 'warn'] });
  try {
    const result = await app.get(DemoSeedService).seed();
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await app.close();
  }
}

await main();
