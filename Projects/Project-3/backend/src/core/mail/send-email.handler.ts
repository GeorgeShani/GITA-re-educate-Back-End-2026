import { Injectable } from '@nestjs/common';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { type MailMessage, mailMessageSchema } from './mail-message.js';
import { MailService } from './mail.service.js';

@Injectable()
export class SendEmailHandler implements TaskHandler<MailMessage> {
  readonly type = 'send_email' as const;
  readonly schema = mailMessageSchema;

  constructor(private readonly mail: MailService) {}

  async handle(payload: MailMessage): Promise<void> {
    await this.mail.send(payload);
  }
}
