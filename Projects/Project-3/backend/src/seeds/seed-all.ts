import '../load-env.js'; // MUST be the first import — see load-env.ts
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { PasswordHasher } from '../auth/crypto/password-hasher.js';
import { AppConfigModule } from '../config/config.module.js';
import { AiModule } from '../core/ai/ai.module.js';
import { AuditModule } from '../core/audit/audit.module.js';
import { CoreModule } from '../core/core.module.js';
import { StorageModule } from '../core/storage/storage.module.js';
import { TasksModule } from '../core/tasks/tasks.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { DemoModule } from '../demo/demo.module.js';
import { DemoSeedService } from '../demo/demo-seed.service.js';
import { FixtureSeedService } from './fixture-seed.service.js';

/**
 * `npm run seed:all` → `node dist/seeds/seed-all.js`: the demo company AND a plain fixture company.
 * Each is idempotent, so this is safe to run on every deploy of a non-production environment. The
 * fixture company refuses to run in production (its password is public); the demo company does not,
 * because it has no password at all.
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
  providers: [PasswordHasher, FixtureSeedService],
})
class SeedAllCliModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedAllCliModule, { logger: ['error', 'warn'] });
  try {
    const demo = await app.get(DemoSeedService).seed();
    process.stdout.write(`demo: ${JSON.stringify(demo)}\n`);
    try {
      const fixture = await app.get(FixtureSeedService).seed();
      process.stdout.write(`fixture: ${JSON.stringify(fixture)}\n`);
    } catch (error) {
      // Production refusal is expected and should not hide that the demo seeded.
      process.stdout.write(`fixture: skipped (${error instanceof Error ? error.message : 'unknown error'})\n`);
      process.exitCode = 0;
    }
  } finally {
    await app.close();
  }
}

await main();
