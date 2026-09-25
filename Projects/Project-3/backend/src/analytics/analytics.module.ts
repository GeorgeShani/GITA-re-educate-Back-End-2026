import { Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

/** Usage analytics. The query functions are exported for reuse by the GraphQL surface. */
@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
