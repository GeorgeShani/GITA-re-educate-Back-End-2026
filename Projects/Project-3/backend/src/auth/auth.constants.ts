/** Token lifetimes (SCOPE.md "Token TTLs"). Every expiry path has a resend/restart route. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
export const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60_000;
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60_000;

export const MIN_PASSWORD_LENGTH = 8;

/** Google sign-in. The exchange code is what the callback hands the browser instead of a session. */
export const OAUTH_EXCHANGE_TOKEN_TTL_MS = 60_000;
/** How long a person has to finish at Google and come back. */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
/** How long the "register a company with this Google account" token stays usable. */
export const OAUTH_REGISTRATION_TTL_SECONDS = 15 * 60;
