// Shared between mail-preview.ts and mail-test.ts. Add a row here in the
// same commit a new template ships (S4's own list right now — see
// notifications.consumer.ts's EMAIL_TEMPLATES for the matching set).
export const MAIL_FIXTURES: Record<string, Record<string, unknown>> = {
  'verify-email': {
    firstName: 'Alex',
    verificationUrl: 'http://localhost:4200/verify-email?token=preview-token',
  },
  'reset-password': {
    firstName: 'Alex',
    resetUrl: 'http://localhost:4200/reset-password?token=preview-token',
  },
};
