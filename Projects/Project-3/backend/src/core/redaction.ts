/**
 * One redaction policy, two consumers.
 *
 * pino's `redact.paths` and `@nestjs/observe`'s `redaction.keys` are separate
 * configs governing the same thing: what must never leave this process in
 * plaintext. SCOPE.md flags these as "easy to specify once and forget to
 * mirror", so both are derived from the lists here rather than written twice.
 *
 * Gridline moves real credentials — activation and invite tokens, refresh
 * tokens, API keys, S3 object keys — so this list is load-bearing, not
 * decorative.
 */

/** Field names scrubbed wherever they appear, at any depth. */
export const REDACT_KEYS = [
  'password',
  'passwordHash',
  'newPassword',
  'currentPassword',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'apiKey',
  'keyHash',
  'appSecret',
  'clientSecret',
  'secret',
  'encryptedSecret',
  'secretIv',
  'secretTag',
  'DATA_ENCRYPTION_KEY',
  'authorization',
  'cookie',
  // One-time links and codes. The email task payload carries these URLs (the token is in the query),
  // and both pino and Observe see task payloads, so they are scrubbed whole, wherever they appear.
  'activationUrl',
  'inviteUrl',
  'resetUrl',
  'inviteToken',
  'resetToken',
  'activationToken',
  'oauthRegistration',
  'oauthRegistrationToken',
  'exchangeCode',
] as const;

/**
 * pino paths. Header and body locations have to be spelled out because pino
 * matches literal paths, not bare key names — the `*.` wildcards cover nesting.
 */
export const REDACT_PINO_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  // A one-time link opened as GET /auth/activate?token=…, and the code Google's sign-in comes back with.
  'req.query.token',
  'req.query.code',
  'req.query.state',
  ...REDACT_KEYS.map((key) => `*.${key}`),
  ...REDACT_KEYS.map((key) => key),
];

export const REDACT_CENSOR = '[redacted]';

/** Query parameters whose values are one-time credentials. */
const ONE_TIME_QUERY_PARAMS = /([?&](?:token|code|state)=)[^&#]*/g;

/**
 * The request's address as it may be logged: the same, with the value of any one-time credential in its query replaced.
 * Redacting `req.query.token` is not enough on its own, because the full address (`url`) is logged beside it.
 */
export function maskOneTimeQuery(url: string): string {
  return url.replace(ONE_TIME_QUERY_PARAMS, `$1${REDACT_CENSOR}`);
}
