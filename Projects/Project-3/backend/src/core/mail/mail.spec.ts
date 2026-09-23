import { beforeAll, describe, expect, it } from 'vitest';
import { type MailMessage, mailMessageSchema } from './mail-message.js';
import { TemplateRenderer } from './template-renderer.js';

const MESSAGES: MailMessage[] = [
  {
    template: 'activation',
    to: 'admin@acme.test',
    vars: { companyName: 'Acme & Sons', activationUrl: 'https://gridline.test/activate?token=abc123' },
  },
  {
    template: 'invite',
    to: 'new@acme.test',
    vars: {
      fullName: 'Nino Beridze',
      companyName: 'Acme',
      inviteUrl: 'https://gridline.test/accept-invite?token=inv456',
    },
  },
  {
    template: 'password_reset',
    to: 'user@acme.test',
    vars: { fullName: 'Nino', resetUrl: 'https://gridline.test/reset?token=rst789' },
  },
  { template: 'password_changed', to: 'user@acme.test', vars: { fullName: 'Nino' } },
  {
    template: 'invoice_finalized',
    to: 'billing@acme.test',
    vars: {
      companyName: 'Acme',
      periodStart: '2026-03-01',
      periodEnd: '2026-03-31',
      totalFormatted: '$50.00',
      invoiceUrl: 'https://gridline.test/billing/invoices/1',
    },
  },
];

describe('TemplateRenderer', () => {
  const renderer = new TemplateRenderer();

  beforeAll(() => renderer.compile());

  it.each(MESSAGES.map((message) => [message.template, message] as const))(
    '%s renders with no unfilled expressions in any part',
    (_name, message) => {
      const email = renderer.render(message);

      for (const part of [email.subject, email.text, email.html]) {
        expect(part).not.toMatch(/\{\{|\}\}/);
      }
      expect(email.to).toBe(message.to);
      expect(email.html).toContain('Gridline');
    },
  );

  it.each(MESSAGES.filter((message) => 'activationUrl' in message.vars || 'inviteUrl' in message.vars || 'resetUrl' in message.vars))(
    '$template puts its link in both the html and the plain-text part',
    (message) => {
      const email = renderer.render(message);
      const url = Object.values(message.vars).find(
        (value) => typeof value === 'string' && value.startsWith('https://'),
      );

      expect(typeof url).toBe('string');
      expect(email.text).toContain(String(url));
      // Handlebars entity-escapes `=` inside the href (`&#x3D;`); a browser
      // decodes it back, so the link is correct — but the raw string differs.
      expect(email.html).toContain(String(url).replaceAll('=', '&#x3D;'));
    },
  );

  it('escapes HTML in the html part but not in the subject or text', () => {
    const [activation] = MESSAGES;
    if (!activation) throw new Error('fixture missing');

    const email = renderer.render(activation);

    expect(email.html).toContain('Acme &amp; Sons');
    expect(email.html).not.toContain('Acme & Sons');
    expect(email.text).toContain('Acme & Sons');
  });

  it('refuses to render before compile()', () => {
    const [activation] = MESSAGES;
    if (!activation) throw new Error('fixture missing');

    expect(() => new TemplateRenderer().render(activation)).toThrow(/not compiled/);
  });
});

describe('mailMessageSchema (the send_email payload boundary)', () => {
  it('accepts every fixture', () => {
    for (const message of MESSAGES) {
      expect(mailMessageSchema.safeParse(message).success).toBe(true);
    }
  });

  it('rejects a missing template variable rather than sending a blank link', () => {
    const result = mailMessageSchema.safeParse({
      template: 'activation',
      to: 'admin@acme.test',
      vars: { companyName: 'Acme' },
    });

    expect(result.success).toBe(false);
  });

  it('rejects an unknown template and a malformed recipient', () => {
    expect(
      mailMessageSchema.safeParse({ template: 'nope', to: 'a@b.test', vars: {} }).success,
    ).toBe(false);
    expect(
      mailMessageSchema.safeParse({
        template: 'password_changed',
        to: 'not-an-email',
        vars: { fullName: 'x' },
      }).success,
    ).toBe(false);
  });

  it('rejects a non-URL link', () => {
    expect(
      mailMessageSchema.safeParse({
        template: 'password_reset',
        to: 'a@b.test',
        vars: { fullName: 'x', resetUrl: 'javascript:alert(1)' },
      }).success,
    ).toBe(false);
  });
});
