/** Token lifetimes (SCOPE.md "Token TTLs"). Every expiry path has a resend/restart route. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60_000;
export const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60_000;
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60_000;

export const MIN_PASSWORD_LENGTH = 8;
