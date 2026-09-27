import { Global, Module } from '@nestjs/common';
import { TasksModule } from '#/core/tasks/tasks.module.js';
import { WebhookPublisher } from './webhook-publisher.service.js';

@Global()
@Module({
  imports: [TasksModule],
  providers: [WebhookPublisher],
  exports: [WebhookPublisher],
})
export class WebhookPublishingModule {}
