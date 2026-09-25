import { Global, Module, type OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthModule } from '#/auth/auth.module.js';
import { AuditBroadcaster } from './audit-broadcaster.js';
import { NotificationBroadcaster } from './notification-broadcaster.js';
import { RealtimeEmitter } from './realtime-emitter.service.js';
import { RealtimeGateway } from './realtime.gateway.js';

/**
 * Global so `FilesService`, the report handler and `EmployeesService` can inject the emitter
 * without importing the whole of realtime. Only the full app registers it: the CLI contexts
 * (billing cycle, demo seed) have no sockets to talk to.
 */
@Global()
@Module({
  imports: [AuthModule],
  providers: [RealtimeGateway, RealtimeEmitter],
  exports: [RealtimeEmitter],
})
export class RealtimeModule implements OnModuleInit {
  constructor(
    private readonly dataSource: DataSource,
    private readonly emitter: RealtimeEmitter,
  ) {}

  onModuleInit(): void {
    this.dataSource.subscribers.push(
      new AuditBroadcaster(this.emitter),
      new NotificationBroadcaster(this.emitter),
    );
  }
}
