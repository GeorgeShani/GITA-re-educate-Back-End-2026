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
 *
 * THE LOOK is the product's "Tabbed Binder": milk-cream stock, print ink, one hairline-ruled leaf, a hue tab along its top
 * edge, chrome-yellow primary actions, and status as a stamp (a word, a symbol AND a colour, never colour alone). The
 * palette is literal hex GENERATED from design/tokens.json (`brand.ts`); email clients have no CSS variables. The voice is
 * the product's: plain, precise, calm. No exclamation marks; numbers beat adjectives.
 */
export interface TemplateDefinition {
  /** Handlebars, compiled unescaped — a subject is not HTML. */
  subject: string;
  /** Handlebars. The plain-text part, and what the console transport prints. */
  text: string;
  /** MJML whose text and attributes may contain Handlebars expressions. */
  mjml: string;
}

export interface TemplateBranding {
  assetsUrl?: string;
}

const L = BRAND;

type Hue = 'tag' | 'ink' | 'teal' | 'blue' | 'sienna' | 'grass' | 'orange';
type Tone = 'pass' | 'hold' | 'caution' | 'idle';

const HUE: Record<Hue, string> = {
  tag: L.tag,
  ink: L.text,
  teal: L.tabTeal,
  blue: L.tabBlue,
  sienna: L.tabSienna,
  grass: L.tabGrass,
  orange: L.tabOrange,
};

const STAMP = {
  pass: { fg: L.pass, bg: L.passSoft, mark: '&#10003;' },
  hold: { fg: L.hold, bg: L.holdSoft, mark: '!' },
  caution: { fg: L.caution, bg: L.cautionSoft, mark: '&#9650;' },
  idle: { fg: L.textMuted, bg: L.sunken, mark: '' },
} as const;

/**
 * Phone tweaks only. The emails have no dark mode for now, and say so to the clients that would otherwise invert them
 * (the `color-scheme` meta below). If one is added, it belongs here, built from a dark palette generated from the tokens.
 */
function mobileStyles(): string {
  return `
      @media only screen and (max-width: 480px) {
        .gl-h1 div { font-size: 30px !important; line-height: 32px !important; }
      }`;
}

/**
 * The mark: an ink tile with a 2x2 grid of label-stock cells, the top-right one the chrome-yellow inspection tag. Drawn
 * with table cells, not an image, so it is crisp, themeable, and needs no CDN. With a brand-assets origin configured the
 * real logo image is used instead (an accessible, fixed-width image).
 */
function header(branding: TemplateBranding): string {
  if (branding.assetsUrl) {
    return `<mj-image src="${branding.assetsUrl}${BRAND.logoPath}" href="{{appUrl}}" width="150px" alt="Gridline" align="left" padding="0 4px" />`;
  }
  const cell = (colour: string, cls: string) =>
    `<td class="${cls}" width="10" height="10" style="width:10px;height:10px;background-color:${colour};border-radius:2px;font-size:0;line-height:0">&nbsp;</td>`;
  return `<mj-text padding="0 4px" css-class="gl-text">
          <a href="{{appUrl}}" style="text-decoration:none;color:${L.text}" class="gl-mark-ink">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;vertical-align:middle;margin-right:10px">
              <tr><td class="gl-tile" style="background-color:${L.text};border-radius:6px;padding:5px">
                <table role="presentation" cellpadding="0" cellspacing="2" border="0" style="border-collapse:separate">
                  <tr>${cell(L.onCover, 'gl-tile-cell')}${cell(L.tag, '')}</tr>
                  <tr>${cell(L.onCover, 'gl-tile-cell')}${cell(L.onCover, 'gl-tile-cell')}</tr>
                </table>
              </td></tr>
            </table>
            <span style="font-family:${BRAND.fontSans};font-size:20px;font-weight:700;vertical-align:middle;letter-spacing:-0.01em" class="gl-mark-ink">Gridline</span>
          </a>
        </mj-text>`;
}

interface LayoutOptions {
  /** The hidden line mail clients show beside the subject. */
  preview: string;
  /** The colour of the tab along the top of the leaf: where in the product this email belongs. */
  hue: Hue;
  /** Why this person is getting it, in one plain sentence. */
  why: string;
  body: string;
}

function layout(options: LayoutOptions, branding: TemplateBranding): string {
  return `
<mjml lang="en">
  <mj-head>
    <mj-title>Gridline</mj-title>
    <mj-preview>${options.preview}</mj-preview>
    <mj-font name="Archivo" href="${BRAND.fontUrl}" />
    <mj-raw>
      <meta name="color-scheme" content="light only" />
      <meta name="supported-color-schemes" content="light only" />
    </mj-raw>
    <mj-attributes>
      <mj-all font-family="${BRAND.fontSans}" />
      <mj-text font-size="16px" line-height="25px" color="${L.text}" padding="0 0 14px" css-class="gl-text" />
    </mj-attributes>
    <mj-style>${mobileStyles()}
    </mj-style>
  </mj-head>
  <mj-body background-color="${L.canvas}" css-class="gl-canvas" width="600px">
    <mj-section padding="28px 12px 14px">
      <mj-column>
        ${header(branding)}
      </mj-column>
    </mj-section>
    <mj-section background-color="${HUE[options.hue]}" padding="0">
      <mj-column>
        <mj-spacer height="6px" />
      </mj-column>
    </mj-section>
    <mj-section background-color="${L.surface}" css-class="gl-card" border-left="1px solid ${L.line}" border-right="1px solid ${L.line}" border-bottom="3px solid ${L.text}" padding="30px 28px 18px">
      <mj-column>
        ${options.body}
      </mj-column>
    </mj-section>
    <mj-section padding="20px 12px 36px">
      <mj-column>
        <mj-text font-size="13px" line-height="20px" color="${L.textSubtle}" padding="0 4px 8px">
          <span class="gl-subtle" style="color:${L.textSubtle}">${options.why}</span>
        </mj-text>
        <mj-text font-size="13px" line-height="20px" color="${L.textSubtle}" padding="0 4px">
          <span class="gl-subtle" style="color:${L.textSubtle}">Gridline &mdash; where a company's spreadsheets live. <a href="{{appUrl}}" class="gl-link" style="color:${L.text};text-decoration:underline">Open Gridline</a></span>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;
}

// ---------- the parts ----------

/** A status as a stamp: condensed uppercase word in a ruled frame, with a symbol so colour is never the only signal. */
function stamp(tone: Tone, label: string): string {
  const s = STAMP[tone];
  const mark = s.mark ? `${s.mark}&nbsp;` : '';
  return `<mj-text padding="0 0 14px"><span class="gl-stamp-${tone}" style="display:inline-block;padding:4px 9px;border:1px solid ${tone === 'idle' ? L.lineStrong : s.fg};background-color:${s.bg};color:${s.fg};border-radius:2px;font-family:${BRAND.fontHeadline};font-size:12px;font-weight:700;letter-spacing:0.08em;line-height:14px;text-transform:uppercase">${mark}${label}</span></mj-text>`;
}

/** The headline: the site's condensed, heavy, uppercase face (Arial Narrow where web fonts are not loaded). */
function heading(text: string): string {
  return `<mj-text css-class="gl-text gl-h1" padding="0 0 16px" font-size="36px" line-height="38px" font-weight="800" font-family="${BRAND.fontHeadline}"><span style="font-stretch:62%;text-transform:uppercase;letter-spacing:-0.005em">${text}</span></mj-text>`;
}

function paragraph(html: string): string {
  return `<mj-text>${html}</mj-text>`;
}

/** The one primary action: chrome-yellow with an ink outline, as in the product. */
function button(label: string, href: string): string {
  return `<mj-button href="${href}" align="left" background-color="${L.tag}" color="${L.onTag}" border="1px solid ${L.text}" border-radius="4px" font-size="16px" font-weight="700" inner-padding="13px 24px" padding="6px 0 20px">${label}</mj-button>`;
}

/** Small print under the action. */
function note(html: string): string {
  return `<mj-text font-size="14px" line-height="22px" padding="0 0 12px"><span class="gl-muted" style="color:${L.textMuted}">${html}</span></mj-text>`;
}

/** For a person whose mail client will not show the button: the address itself, in the mono face, breaking anywhere. */
function fallbackLink(variable: string): string {
  return `<mj-text font-size="13px" line-height="20px" padding="4px 0 14px"><span class="gl-subtle" style="color:${L.textSubtle}">If the button does not work, copy this address into your browser:</span><br /><a href="{{${variable}}}" class="gl-link" style="color:${L.text};font-family:${BRAND.fontMono};font-size:12px;word-break:break-all">{{${variable}}}</a></mj-text>`;
}

/** Label and value pairs on a sunken strip, like a row of a ledger. Values that are data (money, dates) are set in mono. */
function facts(rows: ReadonlyArray<readonly [label: string, value: string]>): string {
  const body = rows
    .map(
      ([label, value], index) =>
        `<tr><td class="gl-fact-label" style="padding:10px 16px;${index > 0 ? `border-top:1px solid ${L.line};` : ''}color:${L.textMuted};font-size:14px;width:40%">${label}</td><td class="gl-fact-value" style="padding:10px 16px;${index > 0 ? `border-top:1px solid ${L.line};` : ''}color:${L.text};font-family:${BRAND.fontMono};font-size:14px;font-weight:600;text-align:right">${value}</td></tr>`,
    )
    .join('');
  return `<mj-table css-class="gl-facts" container-background-color="${L.sunken}" padding="0" cellpadding="0" cellspacing="0" width="100%" font-size="14px">${body}</mj-table>
        <mj-spacer height="20px" />`;
}

const WHY_ACCOUNT =
  'You received this because of activity on a Gridline account that uses this address.';

// ---------- the emails ----------

export function createTemplates(
  branding: TemplateBranding,
): Record<MailTemplateName, TemplateDefinition> {
  return {
    // ---- joining ----

    activation: {
      subject: 'Activate {{companyName}} on Gridline',
      text: [
        'Confirm your email',
        '',
        'You created {{companyName}} on Gridline. Confirm this address to switch the company on:',
        '{{activationUrl}}',
        '',
        'The link works for 24 hours. If it has expired, ask for a new one on the sign-in page.',
        '',
        'You received this because someone registered a company on Gridline with this address. If that was not you, ignore this email: nothing happens until the link is used.',
      ].join('\n'),
      mjml: layout(
        {
          preview: 'Confirm this address to switch on {{companyName}}.',
          hue: 'tag',
          why: 'You received this because someone registered a company on Gridline with this address. If that was not you, ignore this email: nothing happens until the link is used.',
          body: [
            heading('Confirm your email'),
            paragraph(
              'You created <strong>{{companyName}}</strong> on Gridline. Confirm this address to switch the company on.',
            ),
            button('Activate {{companyName}}', '{{activationUrl}}'),
            note(
              'The link works for 24 hours. If it has expired, ask for a new one on the sign-in page.',
            ),
            fallbackLink('activationUrl'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    invite: {
      subject: '{{companyName}} invited you to Gridline',
      text: [
        'You are invited',
        '',
        'Hi {{fullName}},',
        '',
        'An admin at {{companyName}} invited you to Gridline, where the company keeps its spreadsheets: every upload is checked on arrival, and you see only the files shared with you.',
        '',
        'Accept the invitation:',
        '{{inviteUrl}}',
        '',
        'The link works for 7 days. You can join with a password or with Google.',
        '',
        'You received this because an admin at {{companyName}} entered this address. If you were not expecting it, ignore this email.',
      ].join('\n'),
      mjml: layout(
        {
          preview: 'An admin at {{companyName}} invited you to join.',
          hue: 'teal',
          why: 'You received this because an admin at {{companyName}} entered this address. If you were not expecting it, ignore this email.',
          body: [
            heading('You are invited'),
            paragraph('Hi {{fullName}},'),
            paragraph(
              'An admin at <strong>{{companyName}}</strong> invited you to Gridline, where the company keeps its spreadsheets. Every upload is checked on arrival, and you see only the files shared with you.',
            ),
            button('Accept invitation', '{{inviteUrl}}'),
            note(
              'The link works for 7 days. You can join with a password or with Google.',
            ),
            fallbackLink('inviteUrl'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    // ---- signing in ----

    password_reset: {
      subject: 'Reset your Gridline password',
      text: [
        'Reset your password',
        '',
        'Hi {{fullName}},',
        '',
        'We received a request to reset the password for your Gridline account. Choose a new one here:',
        '{{resetUrl}}',
        '',
        'The link works for 1 hour and only once. Your password stays the same until you use it.',
        '',
        'If you did not ask for this, ignore this email.',
      ].join('\n'),
      mjml: layout(
        {
          preview: 'Choose a new password. The link works for 1 hour.',
          hue: 'ink',
          why: 'You received this because a password reset was requested for your Gridline account. If it was not you, ignore this email: your password has not changed.',
          body: [
            heading('Reset your password'),
            paragraph('Hi {{fullName}},'),
            paragraph(
              'We received a request to reset the password for your Gridline account.',
            ),
            button('Choose a new password', '{{resetUrl}}'),
            note(
              'The link works for 1 hour and only once. Your password stays the same until you use it. If you did not ask for this, ignore this email.',
            ),
            fallbackLink('resetUrl'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    password_changed: {
      subject: 'Your Gridline password was changed',
      text: [
        'Your password was changed',
        '',
        'Hi {{fullName}},',
        '',
        'The password for your Gridline account was just changed, and every other session was signed out.',
        '',
        'If this was you, there is nothing to do. If it was not, reset your password now:',
        '{{appUrl}}/forgot-password',
        '',
        WHY_ACCOUNT,
      ].join('\n'),
      mjml: layout(
        {
          preview: 'Every other session was signed out.',
          hue: 'ink',
          why: WHY_ACCOUNT,
          body: [
            stamp('idle', 'Security notice'),
            heading('Your password was changed'),
            paragraph('Hi {{fullName}},'),
            paragraph(
              'The password for your Gridline account was just changed, and every other session was signed out.',
            ),
            paragraph(
              'If this was you, there is nothing to do. If it was not, reset your password now.',
            ),
            button('Reset password', '{{appUrl}}/forgot-password'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    sign_in_method_changed: {
      subject:
        '{{#if added}}{{provider}} was added to{{else}}{{provider}} was removed from{{/if}} your Gridline account',
      text: [
        '{{#if added}}A sign-in method was added{{else}}A sign-in method was removed{{/if}}',
        '',
        'Hi {{fullName}},',
        '',
        '{{provider}} was {{#if added}}linked to{{else}}removed from{{/if}} your Gridline account. {{#if added}}You can now sign in with it.{{else}}You can no longer sign in with it.{{/if}}',
        '',
        'If this was you, there is nothing to do. If it was not, change your password and review your sign-in methods:',
        '{{appUrl}}/settings/linked-accounts',
        '',
        WHY_ACCOUNT,
      ].join('\n'),
      mjml: layout(
        {
          preview:
            '{{#if added}}You can now sign in with {{provider}}.{{else}}You can no longer sign in with {{provider}}.{{/if}}',
          hue: 'ink',
          why: WHY_ACCOUNT,
          body: [
            stamp('idle', 'Security notice'),
            heading(
              '{{#if added}}A sign-in method was added{{else}}A sign-in method was removed{{/if}}',
            ),
            paragraph('Hi {{fullName}},'),
            paragraph(
              '<strong>{{provider}}</strong> was {{#if added}}linked to{{else}}removed from{{/if}} your Gridline account. {{#if added}}You can now sign in with it.{{else}}You can no longer sign in with it.{{/if}}',
            ),
            paragraph(
              'If this was you, there is nothing to do. If it was not, change your password and review your sign-in methods.',
            ),
            button('Review sign-in methods', '{{appUrl}}/settings/linked-accounts'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    // ---- money ----

    invoice_finalized: {
      subject: 'Your Gridline invoice for {{periodStart}} to {{periodEnd}}',
      text: [
        'Your invoice is ready',
        '',
        'Company:       {{companyName}}',
        'Period starts: {{periodStart}}',
        'Period ends:   {{periodEnd}}',
        'Total:         {{totalFormatted}}',
        '',
        'Every line, and the PDF, are on the invoice:',
        '{{invoiceUrl}}',
        '',
        'You received this because this is the billing address of {{companyName}}.',
      ].join('\n'),
      mjml: layout(
        {
          preview: '{{totalFormatted}} for {{periodStart}} to {{periodEnd}}.',
          hue: 'blue',
          why: 'You received this because this is the billing address of {{companyName}}.',
          body: [
            stamp('idle', 'Invoice'),
            heading('Your invoice is ready'),
            facts([
              ['Company', '{{companyName}}'],
              ['Period starts', '{{periodStart}}'],
              ['Period ends', '{{periodEnd}}'],
              ['Total', '{{totalFormatted}}'],
            ]),
            paragraph(
              'Open the invoice to see every line, and to download the PDF.',
            ),
            button('View invoice', '{{invoiceUrl}}'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    quota_threshold: {
      subject:
        '{{companyName}}: {{#if (eq threshold 100)}}all of your files are used{{else}}{{threshold}}% of your files are used{{/if}}',
      text: [
        '{{threshold}}% of your files are used',
        '',
        '{{companyName}}',
        '',
        '{{headline}}',
        '{{detail}}',
        '',
        'Plans and usage:',
        '{{billingUrl}}',
        '',
        'You received this because this is the billing address of {{companyName}}.',
      ].join('\n'),
      mjml: layout(
        {
          preview: '{{headline}}',
          hue: 'blue',
          why: 'You received this because this is the billing address of {{companyName}}.',
          body: [
            // Handlebars blocks sit in <mj-raw>: MJML rejects bare text between components.
            '<mj-raw>{{#if (eq threshold 100)}}</mj-raw>',
            stamp('hold', 'Limit reached'),
            '<mj-raw>{{else}}</mj-raw>',
            stamp('caution', 'Approaching the limit'),
            '<mj-raw>{{/if}}</mj-raw>',
            heading('{{threshold}}% of your files are used'),
            paragraph('<strong>{{companyName}}</strong>'),
            paragraph('{{headline}}'),
            paragraph('{{detail}}'),
            button('See your plan', '{{billingUrl}}'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    payment_failed: {
      subject: 'Payment failed for {{companyName}}',
      text: [
        'We could not collect your payment',
        '',
        'Company:          {{companyName}}',
        'Amount:           {{totalFormatted}}',
        'Grace period ends: {{graceEndsAt}}',
        '',
        'Update the payment method before {{graceEndsAt}}. After that date the company is suspended: people cannot sign in, though admins can still reach billing to fix it. Nothing is deleted.',
        '',
        '{{billingUrl}}',
        '',
        'You received this because this is the billing address of {{companyName}}.',
      ].join('\n'),
      mjml: layout(
        {
          preview: 'Update the payment method before {{graceEndsAt}}.',
          hue: 'blue',
          why: 'You received this because this is the billing address of {{companyName}}.',
          body: [
            stamp('hold', 'Payment failed'),
            heading('We could not collect your payment'),
            facts([
              ['Company', '{{companyName}}'],
              ['Amount', '{{totalFormatted}}'],
              ['Grace period ends', '{{graceEndsAt}}'],
            ]),
            paragraph(
              'Update the payment method before <strong>{{graceEndsAt}}</strong>. After that date the company is suspended: people cannot sign in, though admins can still reach billing to fix it. Nothing is deleted.',
            ),
            button('Update payment method', '{{billingUrl}}'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    company_suspended: {
      subject: '{{companyName}} is suspended until payment is made',
      text: [
        'Access to {{companyName}} is paused',
        '',
        'The payment problem was not fixed before the grace period ended, so Gridline has suspended {{companyName}}. People cannot sign in until the open invoice is paid.',
        '',
        'Admins can still sign in to read billing and pay. Nothing was deleted: your files, versions and reports are kept, and access returns as soon as payment succeeds.',
        '',
        '{{billingUrl}}',
        '',
        'You received this because this is the billing address of {{companyName}}.',
      ].join('\n'),
      mjml: layout(
        {
          preview: 'Pay the open invoice to restore access.',
          hue: 'blue',
          why: 'You received this because this is the billing address of {{companyName}}.',
          body: [
            stamp('hold', 'Suspended'),
            heading('Access to {{companyName}} is paused'),
            paragraph(
              'The payment problem was not fixed before the grace period ended, so Gridline has suspended <strong>{{companyName}}</strong>. People cannot sign in until the open invoice is paid.',
            ),
            paragraph(
              'Admins can still sign in to read billing and pay. Nothing was deleted: your files, versions and reports are kept, and access returns as soon as payment succeeds.',
            ),
            button('Pay the open invoice', '{{billingUrl}}'),
          ].join('\n        '),
        },
        branding,
      ),
    },

    payment_recovered: {
      subject: 'Payment received for {{companyName}}',
      text: [
        'Payment received',
        '',
        'Payment for {{companyName}} succeeded and nothing is overdue. Access is current again.',
        '',
        '{{billingUrl}}',
        '',
        'You received this because this is the billing address of {{companyName}}.',
      ].join('\n'),
      mjml: layout(
        {
          preview: 'Nothing is overdue. Access is current again.',
          hue: 'blue',
          why: 'You received this because this is the billing address of {{companyName}}.',
          body: [
            stamp('pass', 'Paid'),
            heading('Payment received'),
            paragraph(
              'Payment for <strong>{{companyName}}</strong> succeeded and nothing is overdue. Access is current again.',
            ),
            button('Open billing', '{{billingUrl}}'),
          ].join('\n        '),
        },
        branding,
      ),
    },
  };
}
