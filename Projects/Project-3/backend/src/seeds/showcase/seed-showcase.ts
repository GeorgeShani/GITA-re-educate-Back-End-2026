import '../../load-env.js'; // MUST be the first import — see load-env.ts
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ClsModule } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { PasswordHasher } from '../../auth/crypto/password-hasher.js';
import { AppConfigModule } from '../../config/config.module.js';
import type { AppConfig } from '../../config/env.schema.js';
import { APP_CONFIG } from '../../config/load-config.js';
import { AuditModule } from '../../core/audit/audit.module.js';
import { AuditService } from '../../core/audit/audit.service.js';
import { CLOCK, type Clock } from '../../core/clock/clock.js';
import { CoreModule } from '../../core/core.module.js';
import { TasksModule } from '../../core/tasks/tasks.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { BillingSyncService } from '../../payments/billing-sync.service.js';
import { PaymentsModule } from '../../payments/payments.module.js';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module.js';
import { SubscriptionsService } from '../../subscriptions/subscriptions.service.js';
import { USAGE, parseArgs } from './args.js';
import { ShowcaseRunner } from './runner.js';

/**
 * `node --env-file=.env.production.local dist/seeds/showcase/seed-showcase.js --stage accounts|content …` (see `--help`).
 *
 * Seeds three realistic companies with people, files, versions, rules, comments and questions. Run from YOUR machine against the
 * production database (Neon is reachable from it); the content stage also talks to the LIVE API, so uploads, reports, quota, audit and
 * Stripe usage all happen the real way. A standalone application context: no HTTP server, no task runner and no schedule, so nothing
 * fires from here. Seat-count syncs and emails it queues are picked up and sent by the running API.
 */
@Module({
  imports: [
    AppConfigModule,
    ClsModule.forRoot({ global: true }),
    CoreModule,
    DatabaseModule,
    AuditModule,
    TasksModule,
    PaymentsModule,
    SubscriptionsModule,
  ],
  providers: [PasswordHasher],
})
class SeedShowcaseCliModule {}

const log = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    log(USAGE);
    return;
  }
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }

  const app = await NestFactory.createApplicationContext(SeedShowcaseCliModule, { logger: ['error', 'warn'] });
  try {
    const runner = new ShowcaseRunner({
      dataSource: app.get(DataSource),
      hasher: app.get(PasswordHasher),
      config: app.get<AppConfig>(APP_CONFIG),
      clock: app.get<Clock>(CLOCK),
      audit: app.get(AuditService),
      subscriptions: app.get(SubscriptionsService),
      billingSync: app.get(BillingSyncService),
      log,
    });

    if (args.stage === 'accounts') {
      await runner.accounts(args);
      log('');
      log(`Passwords are in ${args.credentialsPath} (and a readable copy beside it as .md). Do not commit them.`);
      log('Next: sign in as the admin of Northwind Logistics and upgrade to Basic, then as the admin of Meridian Clinics and upgrade to Premium,');
      log('both through Checkout with the test card 4242 4242 4242 4242. Wait until each plan shows as active, then run --stage content.');
      return;
    }

    const result = await runner.content(args);
    if (result.blocked.length > 0) {
      process.stderr.write(`Not started:\n${result.blocked.map((problem) => `  - ${problem}`).join('\n')}\n`);
      process.exitCode = 1;
      return;
    }
    log('');
    let failed = false;
    for (const summary of result.summaries) {
      const { slug, failures, notes, ...counts } = summary;
      log(`${slug}: ${JSON.stringify(counts)}`);
      for (const note of notes) log(`  note: ${note}`);
      for (const failure of failures) log(`  FAILED ${failure}`);
      failed ||= failures.length > 0;
    }
    if (failed) {
      log('\nSome steps failed. Run the same command again: what is already there is skipped.');
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

await main();
