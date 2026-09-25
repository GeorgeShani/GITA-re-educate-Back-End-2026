import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsJanitor } from './notifications-janitor.service.js';
import { NotificationsService } from './notifications.service.js';
import { QuotaAlertsService } from './quota-alerts.service.js';

/**
 * Global so `FilesService`, the report handler and `InvoicingService` can write to inboxes without
 * importing it. `BillingModule` imports it explicitly as well, because the billing-cycle CLI boots
 * `BillingModule` without `AppModule` and a global module only exists where something imports it.
 * It depends on nothing but the database: the realtime push is a TypeORM subscriber that
 * `RealtimeModule` registers, so a context without sockets writes inbox rows and pushes nothing.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, QuotaAlertsService, NotificationsJanitor],
  exports: [NotificationsService, QuotaAlertsService],
})
export class NotificationsModule {}
