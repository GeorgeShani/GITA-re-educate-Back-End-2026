import { Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { SubscriptionsModule } from '#/subscriptions/subscriptions.module.js';
import { QualityRulesController } from './quality-rules.controller.js';
import { QualityRulesService } from './quality-rules.service.js';

/** CRUD for a company's data-quality rules. Evaluating them is the report handler's job (`files/quality/rules.ts`). */
@Module({
  imports: [DatabaseModule, SubscriptionsModule],
  controllers: [QualityRulesController],
  providers: [QualityRulesService],
})
export class QualityRulesModule {}
