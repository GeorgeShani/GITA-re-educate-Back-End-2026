import { createHash, randomBytes } from 'node:crypto';
import { API_SCOPES, type ApiScope } from '#/common/auth/require-scopes.decorator.js';
import type { UserRole } from '#/database/entities/user.entity.js';

export const API_KEY_PREFIX = 'gl_live_';

/** `gl_live_` + 8 hex (the public handle) + `_` + 32 random bytes, base64url. */
export const API_KEY_FORMAT = /^gl_live_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/;

export interface GeneratedApiKey {
  /** Shown to the person ONCE. Never stored. */
  plaintext: string;
  /** `gl_live_ab12cd34` — safe to display and to log. */
  prefix: string;
  /** What the database keeps. */
  hash: string;
}

/**
 * 256 bits of randomness, so a fast hash is right (nothing to brute-force) and lookup is a
 * single indexed equality on the hash — the same reasoning as every other opaque token here.
 */
export function generateApiKey(): GeneratedApiKey {
  const handle = randomBytes(4).toString('hex');
  const secret = randomBytes(32).toString('base64url');
  const plaintext = `${API_KEY_PREFIX}${handle}_${secret}`;
  return { plaintext, prefix: `${API_KEY_PREFIX}${handle}`, hash: hashApiKey(plaintext) };
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex');
}

/** Only for ROUTING a bearer token to the right authenticator; validity is `API_KEY_FORMAT` + the database. */
export function looksLikeApiKey(token: string): boolean {
  return token.startsWith(API_KEY_PREFIX);
}

/** What a role may put on a key. Billing is an admin's business; an employee's key cannot reach it. */
export function scopesAllowedFor(role: UserRole): readonly ApiScope[] {
  return role === 'admin' ? API_SCOPES : API_SCOPES.filter((scope) => scope !== 'billing:read');
}

/**
 * A key's power right now: its scopes, narrowed by its creator's CURRENT role. Applied on
 * every request, not just at creation, so a role that loses a right takes the key's copy of
 * it away too.
 */
export function effectiveScopes(role: UserRole, granted: readonly ApiScope[]): ApiScope[] {
  const allowed = scopesAllowedFor(role);
  return granted.filter((scope) => allowed.includes(scope));
}
