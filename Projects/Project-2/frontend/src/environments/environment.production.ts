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
  stripePublishableKey: '',
};
