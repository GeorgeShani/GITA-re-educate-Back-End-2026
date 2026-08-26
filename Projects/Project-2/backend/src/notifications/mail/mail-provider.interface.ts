import type { EmailCategory } from '../schemas/email-message.schema';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  category: EmailCategory;
}

export interface MailSendResult {
  providerMessageId?: string;
}

// SCOPE.md B4 — same provider-abstraction shape as StorageProvider (S6)
// and PaymentProvider (S9). Three implementations select on MAIL_PROVIDER
// via MAIL_PROVIDER_TOKEN in notifications.module.ts.
export interface MailProvider {
  send(message: MailMessage): Promise<MailSendResult>;
  sendBatch(messages: MailMessage[]): Promise<MailSendResult[]>;
  /** Verifies a provider webhook signature. Throws if the provider can't sign at all (e.g. Console/Noop). */
  verifyWebhook(payload: string, headers: Record<string, string | undefined>): boolean;
}

export const MAIL_PROVIDER_TOKEN = Symbol('MAIL_PROVIDER');
