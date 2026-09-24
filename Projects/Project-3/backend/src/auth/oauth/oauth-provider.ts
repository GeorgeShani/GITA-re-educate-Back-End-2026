/**
 * The seam every social sign-in provider implements (SCOPE.md "What this buys").
 * Nothing downstream compares emails to identify anyone: a provider's only job is
 * to hand back a durable `providerUserId` to recognise the person by next time.
 * Adding Apple later is one more implementation of this interface.
 */
export interface OAuthProfile {
  /** The provider's stable subject (`sub`) — never the email. */
  providerUserId: string;
  /** As the provider reports it. May be a relay address, may be absent. */
  email: string | null;
  /** The provider's own claim; only ever trusted alongside an exact match. */
  emailVerified: boolean;
  name: string | null;
}

export interface OAuthProvider {
  readonly provider: 'google';
  /** The URL to send the browser to; `state` comes back verbatim on the callback. */
  authorizationUrl(state: string): string;
  /** Trades the one-time authorization code for who signed in. Rejects on any failure. */
  exchangeCode(code: string): Promise<OAuthProfile>;
}

/**
 * Provided as `null` when the `GOOGLE_*` variables are unset, so password auth
 * is unaffected and the Google routes answer 503. Tests override it with a fake.
 */
export const GOOGLE_OAUTH = Symbol('GOOGLE_OAUTH');
