import { Module } from '@nestjs/common';
import { AuthModule } from '#/auth/auth.module.js';
import { BillingModule } from '#/billing/billing.module.js';
import { DatabaseModule } from '#/database/database.module.js';
import { DemoController } from './demo.controller.js';
import { DemoReadOnlyGuard } from './demo-read-only.guard.js';
import { DemoSeedService } from './demo-seed.service.js';
import { DemoService } from './demo.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, BillingModule],
  controllers: [DemoController],
  providers: [DemoService, DemoSeedService, DemoReadOnlyGuard],
  // The guard is registered globally by `AccessControlModule`; the seeder is what the CLI boots.
  exports: [DemoReadOnlyGuard, DemoSeedService],
})
export class DemoModule {}
