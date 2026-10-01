import { Module } from '@nestjs/common';
import { BillingModule } from '#/billing/billing.module.js';
import { IdempotencyModule } from '#/core/idempotency/idempotency.module.js';
import { DatabaseModule } from '#/database/database.module.js';
import { SubscriptionsModule } from '#/subscriptions/subscriptions.module.js';
import { WebhookPublishingModule } from '#/outgoing-webhooks/webhook-publishing.module.js';
import { BuildDataQualityReportHandler } from './build-data-quality-report.handler.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { ReportsService } from './quality/reports.service.js';

/**
 * Storage and the task queue are global modules, so they are not imported here (idempotency is, explicitly, because
 * the standalone job contexts boot this module without AppModule). `TaskRunnerModule` imports this module to register the report
 * handler, which is why the handler is exported.
 */
@Module({
  imports: [
    IdempotencyModule,
    DatabaseModule,
    BillingModule,
    SubscriptionsModule,
    WebhookPublishingModule,
  ],
  controllers: [FilesController],
  providers: [FilesService, ReportsService, BuildDataQualityReportHandler],
  exports: [FilesService, ReportsService, BuildDataQualityReportHandler],
})
export class FilesModule {}
