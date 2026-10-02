import type { MailMessage } from './mail-message.js';

/**
 * One realistic message per template. The renderer's specs run against these, and `npm run mail:preview` renders them to
 * HTML files so a person can open each email in a browser. Keep one entry per template: the spec fails if one is missing.
 */
export const SAMPLE_MESSAGES: MailMessage[] = [
  {
    template: 'activation',
    to: 'nino@acme.test',
    vars: {
      companyName: 'Acme & Sons',
      activationUrl:
        'https://gridline.test/activate?token=TLoiIJq9ueWKoWrWm_55r3vaT72ASazXZwSl8_lsSUQ',
    },
  },
  {
    template: 'invite',
    to: 'tamar@acme.test',
    vars: {
      fullName: 'Tamar Beridze',
      companyName: 'Acme & Sons',
      inviteUrl:
        'https://gridline.test/accept-invite?token=0x1r2yTnJ4QZcXk7fE3B9vLwUa5mGdHsP8oRtNqYiK',
    },
  },
  {
    template: 'password_reset',
    to: 'nino@acme.test',
    vars: {
      fullName: 'Nino Beridze',
      resetUrl:
        'https://gridline.test/reset-password?token=Qm4vB8zJkR2sXtLw9cYhN6dEaUfP3oGiV7yTnKxA',
    },
  },
  {
    template: 'password_changed',
    to: 'nino@acme.test',
    vars: { fullName: 'Nino Beridze' },
  },
  {
    template: 'sign_in_method_changed',
    to: 'nino@acme.test',
    vars: { fullName: 'Nino Beridze', provider: 'Google', added: true },
  },
  {
    template: 'invoice_finalized',
    to: 'billing@acme.test',
    vars: {
      companyName: 'Acme & Sons',
      periodStart: 'September 14, 2026',
      periodEnd: 'October 14, 2026',
      totalFormatted: '$1,250.50',
      invoiceUrl: 'https://gridline.test/billing/invoices/inv_1',
    },
  },
  {
    template: 'quota_threshold',
    to: 'billing@acme.test',
    vars: {
      companyName: 'Acme & Sons',
      threshold: 80,
      headline: 'Your company has used 80% of its files for this period.',
      detail:
        '80 of 100 files on the Basic plan. At 100 files uploads stop until November 14, 2026, unless you move to the Premium plan.',
      billingUrl: 'https://gridline.test/billing',
    },
  },
  {
    template: 'payment_failed',
    to: 'billing@acme.test',
    vars: {
      companyName: 'Acme & Sons',
      totalFormatted: '$1,250.50',
      graceEndsAt: 'October 21, 2026',
      billingUrl: 'https://gridline.test/billing',
    },
  },
  {
    template: 'company_suspended',
    to: 'billing@acme.test',
    vars: {
      companyName: 'Acme & Sons',
      billingUrl: 'https://gridline.test/billing',
    },
  },
  {
    template: 'payment_recovered',
    to: 'billing@acme.test',
    vars: {
      companyName: 'Acme & Sons',
      billingUrl: 'https://gridline.test/billing',
    },
  },
];

/** The same quota email at 100%: a different stamp and subject, so the preview shows both. */
export const SAMPLE_QUOTA_FULL: MailMessage = {
  template: 'quota_threshold',
  to: 'billing@acme.test',
  vars: {
    companyName: 'Acme & Sons',
    threshold: 100,
    headline: 'Your company has used all of its files for this period.',
    detail:
      '100 of 100 files on the Basic plan. Uploads stop until November 14, 2026, unless you move to the Premium plan.',
    billingUrl: 'https://gridline.test/billing',
  },
};

/** The sign-in notice when a method is removed rather than added. */
export const SAMPLE_SIGN_IN_REMOVED: MailMessage = {
  template: 'sign_in_method_changed',
  to: 'nino@acme.test',
  vars: { fullName: 'Nino Beridze', provider: 'Google', added: false },
};
