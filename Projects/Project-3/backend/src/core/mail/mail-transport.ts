import type { RenderedEmail } from './mail-message.js';

/** The seam between rendering and delivery. Tests swap in a capturing fake. */
export interface MailTransport {
  send(email: RenderedEmail): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
