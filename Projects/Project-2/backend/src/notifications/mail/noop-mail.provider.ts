import { Injectable } from '@nestjs/common';

import type {
  MailMessage,
  MailProvider,
  MailSendResult,
} from './mail-provider.interface';

// MAIL_PROVIDER=noop — for tests. No I/O, no filesystem writes, nothing
// to assert against except that NotificationsService's own logic (dedupe,
// suppression, dev gate) ran correctly.
@Injectable()
export class NoopMailProvider implements MailProvider {
  send(): Promise<MailSendResult> {
    return Promise.resolve({ providerMessageId: 'noop' });
  }

  sendBatch(messages: MailMessage[]): Promise<MailSendResult[]> {
    return Promise.resolve(messages.map(() => ({ providerMessageId: 'noop' })));
  }

  verifyWebhook(): boolean {
    return true;
  }
}
