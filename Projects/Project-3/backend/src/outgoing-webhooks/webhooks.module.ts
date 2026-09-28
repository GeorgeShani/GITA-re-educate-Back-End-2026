import { Module } from '@nestjs/common';
import { DatabaseModule } from '#/database/database.module.js';
import { DeliverWebhookHandler } from './deliver-webhook.handler.js';
import { WebhookDeliveriesJanitor } from './webhook-deliveries-janitor.service.js';
import { WebhookDestinationService } from './webhook-destination.service.js';
import { WebhookPublishingModule } from './webhook-publishing.module.js';
import { WebhookSecretService } from './webhook-secret.service.js';
import {
  WEBHOOK_TRANSPORT,
  UndiciWebhookTransport,
} from './webhook-transport.js';
import { WebhooksController } from './webhooks.controller.js';
import { WebhooksService } from './webhooks.service.js';

@Module({
  imports: [DatabaseModule, WebhookPublishingModule],
  controllers: [WebhooksController],
  providers: [
    WebhooksService,
    WebhookSecretService,
    WebhookDestinationService,
    WebhookDeliveriesJanitor,
    UndiciWebhookTransport,
    { provide: WEBHOOK_TRANSPORT, useExisting: UndiciWebhookTransport },
    DeliverWebhookHandler,
  ],
  exports: [DeliverWebhookHandler, WEBHOOK_TRANSPORT],
})
export class WebhooksModule {}
