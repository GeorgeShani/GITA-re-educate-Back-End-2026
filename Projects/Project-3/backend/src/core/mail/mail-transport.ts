import type { RenderedEmail } from './mail-message.js';

/** The seam between rendering and delivery. Tests swap in a capturing fake. */
export interface MailTransport {
  send(email: RenderedEmail): Promise<void>;
  /**
   * Proves the connection and login work without sending anything. Only a real mail server has anything to prove, so the
   * console transport and test fakes have none. Used by `npm run verify:integrations`.
   */
  verify?(): Promise<void>;
}

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');
