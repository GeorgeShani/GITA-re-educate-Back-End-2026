import { Module } from '@nestjs/common';
import { AuditLogModule } from '#/audit/audit-log.module.js';
import { BillingModule } from '#/billing/billing.module.js';
import { CommentsModule } from '#/comments/comments.module.js';
import { FilesModule } from '#/files/files.module.js';
import { QualityRulesModule } from '#/quality-rules/quality-rules.module.js';
import { SubscriptionsModule } from '#/subscriptions/subscriptions.module.js';
import { McpController } from './mcp.controller.js';
import { McpServerFactory } from './mcp-server.factory.js';
import { McpServices } from './mcp-services.js';

/**
 * The MCP endpoint (`POST /mcp`) and the tools behind it. It imports the modules whose services the tools call and
 * adds no storage, no queries and no rules of its own. Notifications and idempotency are global modules.
 */
@Module({
  imports: [
    FilesModule,
    CommentsModule,
    QualityRulesModule,
    SubscriptionsModule,
    BillingModule,
    AuditLogModule,
  ],
  controllers: [McpController],
  providers: [McpServices, McpServerFactory],
})
export class McpModule {}
