/**
 * Development config. Swapped for environment.production.ts at build time
 * via angular.json's fileReplacements — Angular has no runtime `.env`
 * loading, so this file (not an actual .env) is the frontend's equivalent.
 * See frontend/docs/ENV_SECRETS_GUIDE.md.
 */
export const environment = {
  production: false,

  /**
   * Publishable key (safe to ship in a client bundle by design — Stripe's
   * own docs call it "publishable" for exactly that reason). This is a
   * real Stripe test-mode key; do not put a live key here or in
   * environment.production.ts committed to source — inject the live key
   * at build time instead (see the guide).
   */
  stripePublishableKey:
    'pk_test_51UD4rg8538vFr9IQPpl7Db0AuoLG9s9YfNpnm6AF6v8tRXHjLc44Qt2uCy32nMOySjx56M1nxGSPTIdb7lUwnnCh009oTscZ5d',
};
