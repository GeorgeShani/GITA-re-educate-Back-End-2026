// Shared between mail-preview.ts and mail-test.ts. Add a row here in the
// same commit a new template ships — see notifications.consumer.ts's
// EMAIL_TEMPLATES for the matching set.
//
// `appUrl`/`year` are the shared header/footer variables that
// NotificationsService.commonTemplateVariables() merges in at send time;
// the preview/test scripts don't go through that service, so they're
// spread onto every fixture here.
const COMMON = {
  appUrl: 'http://localhost:4200',
  year: new Date().getFullYear(),
};

export const MAIL_FIXTURES: Record<string, Record<string, unknown>> = {
  'verify-email': {
    ...COMMON,
    firstName: 'Alex',
    verificationUrl: 'http://localhost:4200/verify-email?token=preview-token',
  },
  'reset-password': {
    ...COMMON,
    firstName: 'Alex',
    resetUrl: 'http://localhost:4200/reset-password?token=preview-token',
  },
};
