/**
 * Shared between `main.ts` (which mints the nonce and feeds it to helmet's
 * `script-src`) and `scalar.ts` (which reads it back to hand to
 * `apiReference()`). One key, so the two sides can't drift.
 */
export const CSP_NONCE_LOCALS_KEY = 'cspNonce';
