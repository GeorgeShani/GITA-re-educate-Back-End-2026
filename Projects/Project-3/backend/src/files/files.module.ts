import { Module } from '@nestjs/common';
import { BillingModule } from '#/billing/billing.module.js';
import { DatabaseModule } from '#/database/database.module.js';
import { SubscriptionsModule } from '#/subscriptions/subscriptions.module.js';
import { BuildDataQualityReportHandler } from './build-data-quality-report.handler.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';

/**
 * Storage, idempotency and the task queue are global modules, so they are not
 * imported here. `TaskRunnerModule` imports this module to register the report
 * handler, which is why the handler is exported.
 */
@Module({
  imports: [DatabaseModule, BillingModule, SubscriptionsModule],
  controllers: [FilesController],
  providers: [FilesService, BuildDataQualityReportHandler],
  exports: [BuildDataQualityReportHandler],
})
export class FilesModule {}
