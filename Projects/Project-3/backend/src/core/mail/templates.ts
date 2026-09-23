import { BRAND } from './brand.js';
import type { MailTemplateName } from './mail-message.js';

/**
 * MJML + Handlebars, held as TypeScript strings rather than `.mjml` files.
 * `nest build` only compiles `.ts`; loading sibling asset files from `dist/`
 * would need an assets pipeline for no benefit. Strings are typed, bundled and
 * work identically under Vitest and `node dist/main.js`.
 *
 * MJML runs once at boot over the source (its output structure never depends
 * on the variables), and Handlebars fills the variables per send.
 */
export interface TemplateDefinition {
  /** Handlebars, compiled unescaped — a subject is not HTML. */
  subject: string;
  /** Handlebars. The plain-text part, and what the console transport prints. */
  text: string;
  /** MJML whose text and attributes may contain Handlebars expressions. */
  mjml: string;
}

function layout(body: string): string {
  return `
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
      <mj-text font-size="15px" line-height="24px" color="${BRAND.text}" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="${BRAND.background}">
    <mj-section padding="32px 0 8px">
      <mj-column>
        <mj-text font-size="18px" font-weight="700" color="${BRAND.primary}" align="center">
          Gridline
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="${BRAND.surface}" border="1px solid ${BRAND.border}" padding="24px 16px">
      <mj-column>
        ${body}
      </mj-column>
    </mj-section>
    <mj-section padding="16px 0 32px">
      <mj-column>
        <mj-text font-size="12px" color="${BRAND.textMuted}" align="center">
          Gridline — where a company's spreadsheets live.
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

function button(label: string, href: string): string {
  return `<mj-button background-color="${BRAND.primary}" color="${BRAND.primaryText}" href="${href}" border-radius="4px" font-size="15px">${label}</mj-button>`;
}

export const TEMPLATES: Record<MailTemplateName, TemplateDefinition> = {
  activation: {
    subject: 'Activate your Gridline account',
    text: 'Welcome to Gridline. Activate {{companyName}} to get started:\n{{activationUrl}}\n\nThis link expires in 24 hours.',
    mjml: layout(`
        <mj-text>Welcome to Gridline. Activate <strong>{{companyName}}</strong> to get started.</mj-text>
        ${button('Activate account', '{{activationUrl}}')}
        <mj-text font-size="13px" color="${BRAND.textMuted}">This link expires in 24 hours.</mj-text>`),
  },

  invite: {
    subject: "You're invited to {{companyName}} on Gridline",
    text: 'Hi {{fullName}},\n\nYou have been invited to join {{companyName}} on Gridline. Accept the invitation:\n{{inviteUrl}}\n\nThis link expires in 7 days.',
    mjml: layout(`
        <mj-text>Hi {{fullName}},</mj-text>
        <mj-text>You have been invited to join <strong>{{companyName}}</strong> on Gridline.</mj-text>
        ${button('Accept invitation', '{{inviteUrl}}')}
        <mj-text font-size="13px" color="${BRAND.textMuted}">This link expires in 7 days.</mj-text>`),
  },

  password_reset: {
    subject: 'Reset your Gridline password',
    text: 'Hi {{fullName}},\n\nReset your password:\n{{resetUrl}}\n\nThis link expires in 1 hour. If you did not ask for this, ignore this email.',
    mjml: layout(`
        <mj-text>Hi {{fullName}},</mj-text>
        <mj-text>We received a request to reset your password.</mj-text>
        ${button('Reset password', '{{resetUrl}}')}
        <mj-text font-size="13px" color="${BRAND.textMuted}">This link expires in 1 hour. If you did not ask for this, you can ignore this email.</mj-text>`),
  },

  password_changed: {
    subject: 'Your Gridline password was changed',
    text: 'Hi {{fullName}},\n\nYour password was just changed and all other sessions were signed out. If this was not you, reset your password immediately.',
    mjml: layout(`
        <mj-text>Hi {{fullName}},</mj-text>
        <mj-text>Your password was just changed and all other sessions were signed out. If this was not you, reset your password immediately.</mj-text>`),
  },

  invoice_finalized: {
    subject: 'Your Gridline invoice for {{periodStart}} – {{periodEnd}}',
    text: 'Your invoice for {{companyName}} ({{periodStart}} – {{periodEnd}}) is ready. Total: {{totalFormatted}}\n{{invoiceUrl}}',
    mjml: layout(`
        <mj-text>Your invoice for <strong>{{companyName}}</strong> is ready.</mj-text>
        <mj-text>Period: {{periodStart}} – {{periodEnd}}<br />Total: <strong>{{totalFormatted}}</strong></mj-text>
        ${button('View invoice', '{{invoiceUrl}}')}`),
  },
};
