import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AuditLogService } from '#/audit/audit-log.service.js';
import { BillingService } from '#/billing/billing.service.js';
import { CommentsService } from '#/comments/comments.service.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { IdempotencyStore } from '#/core/idempotency/idempotency-store.js';
import { FilesService } from '#/files/files.service.js';
import { ReportsService } from '#/files/quality/reports.service.js';
import { NotificationsService } from '#/notifications/notifications.service.js';
import { QualityRulesService } from '#/quality-rules/quality-rules.service.js';
import { SubscriptionsService } from '#/subscriptions/subscriptions.service.js';

/**
 * Everything a tool may call, in one place. The tools are the same services the REST controllers call — never a data
 * path of their own — so this is a list of the doors, not a layer of logic.
 */
@Injectable()
export class McpServices {
  constructor(
    readonly files: FilesService,
    readonly reports: ReportsService,
    readonly comments: CommentsService,
    readonly rules: QualityRulesService,
    readonly subscriptions: SubscriptionsService,
    readonly billing: BillingService,
    readonly audit: AuditLogService,
    readonly notifications: NotificationsService,
    readonly idempotency: IdempotencyStore,
    readonly context: RequestContextService,
    readonly logger: PinoLogger,
  ) {
    this.logger.setContext('Mcp');
  }
}
