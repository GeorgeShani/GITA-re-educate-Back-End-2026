import { Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { AuditLogController } from './audit-log.controller.js';
import { AuditLogService } from './audit-log.service.js';

/** The read side of the audit log (`GET /audit`). Recording lives in `core/audit`. */
@Module({
  imports: [DatabaseModule],
  controllers: [AuditLogController],
  providers: [AuditLogService],
})
export class AuditLogModule {}
