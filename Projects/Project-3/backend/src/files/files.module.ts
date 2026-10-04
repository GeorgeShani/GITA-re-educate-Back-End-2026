import { Module } from '@nestjs/common';
import { BillingModule } from '#/billing/billing.module.js';
import { IdempotencyModule } from '#/core/idempotency/idempotency.module.js';
import { DatabaseModule } from '#/database/database.module.js';
import { SubscriptionsModule } from '#/subscriptions/subscriptions.module.js';
import { WebhookPublishingModule } from '#/outgoing-webhooks/webhook-publishing.module.js';
import { OrphanedObjectsJanitor } from './orphaned-objects-janitor.service.js';
import { ExploreController } from './explore/explore.controller.js';
import { ExploreService } from './explore/explore.service.js';
import { SheetCache } from './explore/sheet-cache.js';
import { BuildVersionDiffHandler } from './diff/build-version-diff.handler.js';
import { RowDiffController } from './diff/row-diff.controller.js';
import { RowDiffService } from './diff/row-diff.service.js';
import { ApplyCleaningRecipeHandler } from './cleaning/apply-cleaning-recipe.handler.js';
import { CleaningController } from './cleaning/cleaning.controller.js';
import { CleaningService } from './cleaning/cleaning.service.js';
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
  controllers: [FilesController, CleaningController, RowDiffController, ExploreController],
  providers: [FilesService, ReportsService, BuildDataQualityReportHandler, OrphanedObjectsJanitor, CleaningService, ApplyCleaningRecipeHandler, RowDiffService, BuildVersionDiffHandler, ExploreService, SheetCache],
  exports: [FilesService, ReportsService, BuildDataQualityReportHandler, ApplyCleaningRecipeHandler, RowDiffService, BuildVersionDiffHandler, ExploreService],
})
export class FilesModule {}
