import type { RenderedEmail } from '../../src/core/mail/mail-message.js';
import type { MailTransport } from '../../src/core/mail/mail-transport.js';

/**
 * Stands in for the real mail transport. Tests read what *would* have been
 * sent — including the link, which is how a spec "clicks" an activation email.
 */
export class MailCapture implements MailTransport {
  readonly sent: RenderedEmail[] = [];

  async send(email: RenderedEmail): Promise<void> {
    this.sent.push(email);
  }

  clear(): void {
    this.sent.length = 0;
  }

  to(address: string): RenderedEmail[] {
    return this.sent.filter((email) => email.to === address);
  }

  latestTo(address: string): RenderedEmail | undefined {
    return this.to(address).at(-1);
  }

  /** The first URL in the most recent email to `address`, parsed. */
  latestLinkTo(address: string): URL {
    const email = this.latestTo(address);
    if (!email) throw new Error(`No email was sent to ${address}`);

    const match = /https?:\/\/\S+/.exec(email.text);
    if (!match) throw new Error(`The email to ${address} contains no link:\n${email.text}`);
    return new URL(match[0]);
  }

  /** The `token` query parameter of that link. */
  latestTokenTo(address: string): string {
    const token = this.latestLinkTo(address).searchParams.get('token');
    if (!token) throw new Error(`The link emailed to ${address} carries no token`);
    return token;
  }
}
