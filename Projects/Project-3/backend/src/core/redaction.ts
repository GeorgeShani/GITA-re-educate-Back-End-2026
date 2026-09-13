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
  'authorization',
  'cookie',
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
  ...REDACT_KEYS.map((key) => `*.${key}`),
  ...REDACT_KEYS.map((key) => key),
];

export const REDACT_CENSOR = '[redacted]';
