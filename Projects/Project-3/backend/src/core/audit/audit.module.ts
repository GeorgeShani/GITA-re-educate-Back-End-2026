import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { AuditService } from './audit.service.js';

/** Global: every domain module records audit entries. */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
