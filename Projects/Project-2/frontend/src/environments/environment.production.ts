/**
 * Production config — see environment.ts and
 * frontend/docs/ENV_SECRETS_GUIDE.md. Swapped in via angular.json's
 * fileReplacements for the `production` build configuration.
 *
 * Left blank deliberately: the real live-mode key belongs in whatever
 * injects it at build/deploy time (CI secret -> a build step that writes
 * this file, or a fileReplacements target added at deploy), never
 * committed here in plain text.
 */
export const environment = {
  production: true,

  // Absolute, not relative: the frontend (Vercel) and API (Fly.io) are
  // deployed on separate domains, so there's no dev proxy to make a
  // relative /api/v1 resolve to the right host. Cross-origin requests
  // still carry the guest-cart cookie — see cart.controller.ts's
  // maybeSetGuestCookie for the matching sameSite:'none' change.
  apiBaseUrl: 'https://elegant-golf-accessories-backend.fly.dev/api/v1',

  stripePublishableKey:
    'pk_test_51UD4rg8538vFr9IQPpl7Db0AuoLG9s9YfNpnm6AF6v8tRXHjLc44Qt2uCy32nMOySjx56M1nxGSPTIdb7lUwnnCh009oTscZ5d',
};
