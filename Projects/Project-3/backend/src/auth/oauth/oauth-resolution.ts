import type { OAuthProfile } from './oauth-provider.js';
import { contactFromProfile } from './relay-address.js';

export const OAUTH_INTENTS = ['login', 'register', 'invite', 'link'] as const;
export type OAuthIntent = (typeof OAUTH_INTENTS)[number];

/** Why a callback ended without a session. These reach the frontend as `?error=`. */
export const OAUTH_ERROR_CODES = [
  'access_denied',
  'invalid_state',
  'provider_error',
  'invalid_invite',
  'identity_in_use',
  'already_linked',
  'not_activated',
  'account_unavailable',
  'ambiguous_email',
] as const;
export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number];

/** An active user whose contact address equals the provider's (already lower-cased). */
export interface EmailCandidate {
  userId: string;
  companyActive: boolean;
}

export interface ResolutionInput {
  intent: OAuthIntent;
  /** Who started a `link` flow, from the signed state. */
  stateUserId: string | null;
  /** The user who already owns this `(provider, sub)`, if anyone. */
  knownIdentityUserId: string | null;
  profile: OAuthProfile;
  /** Only consulted when discovery by email is allowed; the caller may skip the query otherwise. */
  emailCandidates: EmailCandidate[];
}

export type Resolution =
  /** Sign this user in. `viaEmail` = the identity does not exist yet and must be linked first. */
  | { kind: 'sign_in'; userId: string; viaEmail: boolean }
  /** Bind the identity to whoever the invite token names. */
  | { kind: 'bind_invite' }
  | { kind: 'link'; userId: string; alreadyLinked: boolean }
  /** Nobody here: offer to register a new company. Never silently joins an existing one. */
  | { kind: 'register' }
  | { kind: 'refuse'; reason: OAuthErrorCode };

/**
 * Whether discovery by email is allowed at all. Discovery is the dangerous path
 * (an attacker mints an account at a sloppy provider carrying your address), so
 * it needs a verified, non-relay address; the caller uses this to skip the query.
 */
export function mayDiscoverByEmail(intent: OAuthIntent, profile: OAuthProfile): boolean {
  return (intent === 'login' || intent === 'register') && contactFromProfile(profile).verified;
}

/**
 * SCOPE.md's identity table, as one pure function so every row is a unit test.
 *
 * - A known `(provider, sub)` signs in. The email is never consulted.
 * - An invite binds to the invited user with NO email comparison.
 * - A link binds to the signed-in user who started it, again with no comparison.
 * - Only otherwise, and only for a verified non-relay address matching exactly one
 *   active user's contact address, is an identity auto-linked.
 * - Anything else offers company registration.
 */
export function resolveOAuth(input: ResolutionInput): Resolution {
  const { intent, knownIdentityUserId, profile } = input;

  if (intent === 'invite') {
    // The invite belongs to one invited user; a Google account that already
    // belongs to someone else cannot also become theirs.
    return knownIdentityUserId ? { kind: 'refuse', reason: 'identity_in_use' } : { kind: 'bind_invite' };
  }

  if (intent === 'link') {
    if (!input.stateUserId) return { kind: 'refuse', reason: 'invalid_state' };
    if (knownIdentityUserId === null) {
      return { kind: 'link', userId: input.stateUserId, alreadyLinked: false };
    }
    return knownIdentityUserId === input.stateUserId
      ? { kind: 'link', userId: input.stateUserId, alreadyLinked: true }
      : { kind: 'refuse', reason: 'identity_in_use' };
  }

  if (knownIdentityUserId) {
    return { kind: 'sign_in', userId: knownIdentityUserId, viaEmail: false };
  }

  if (!mayDiscoverByEmail(intent, profile)) return { kind: 'register' };

  const [only, ...others] = input.emailCandidates;
  if (!only) return { kind: 'register' };
  // Two companies each hold an active person at this address: which one is this?
  // Guessing is exactly what the identity model exists to avoid.
  if (others.length > 0) return { kind: 'refuse', reason: 'ambiguous_email' };
  if (!only.companyActive) return { kind: 'refuse', reason: 'account_unavailable' };
  return { kind: 'sign_in', userId: only.userId, viaEmail: true };
}
