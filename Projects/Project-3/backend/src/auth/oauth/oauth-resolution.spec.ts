import { describe, expect, it } from 'vitest';
import type { OAuthProfile } from './oauth-provider.js';
import { type OAuthIntent, type ResolutionInput, mayDiscoverByEmail, resolveOAuth } from './oauth-resolution.js';

const ALICE = '11111111-1111-4111-8111-111111111111';
const BOB = '22222222-2222-4222-8222-222222222222';

const verified: OAuthProfile = {
  providerUserId: 'sub-1',
  email: 'alice@acme.com',
  emailVerified: true,
  name: 'Alice',
};

function input(overrides: Partial<ResolutionInput> = {}): ResolutionInput {
  return {
    intent: 'login',
    stateUserId: null,
    knownIdentityUserId: null,
    profile: verified,
    emailCandidates: [],
    ...overrides,
  };
}

/** SCOPE.md's identity table, one row per test. */
describe('resolveOAuth', () => {
  describe('known identity → sign in, email never consulted', () => {
    it('signs in even when the provider email matches nobody', () => {
      expect(
        resolveOAuth(input({ knownIdentityUserId: ALICE, profile: { ...verified, email: 'other@x.com' } })),
      ).toEqual({ kind: 'sign_in', userId: ALICE, viaEmail: false });
    });

    it('signs in even when the provider email matches a DIFFERENT user', () => {
      expect(
        resolveOAuth(
          input({ knownIdentityUserId: ALICE, emailCandidates: [{ userId: BOB, companyActive: true }] }),
        ),
      ).toEqual({ kind: 'sign_in', userId: ALICE, viaEmail: false });
    });

    it('signs in with no email at all', () => {
      expect(
        resolveOAuth(
          input({ knownIdentityUserId: ALICE, profile: { ...verified, email: null, emailVerified: false } }),
        ),
      ).toEqual({ kind: 'sign_in', userId: ALICE, viaEmail: false });
    });

    it('treats `register` like `login` for someone who already has an account', () => {
      expect(resolveOAuth(input({ intent: 'register', knownIdentityUserId: ALICE }))).toEqual({
        kind: 'sign_in',
        userId: ALICE,
        viaEmail: false,
      });
    });
  });

  describe('invite → bind to the invited user, no email comparison', () => {
    it('binds whatever identity comes back', () => {
      expect(
        resolveOAuth(input({ intent: 'invite', profile: { ...verified, email: 'personal@gmail.com' } })),
      ).toEqual({ kind: 'bind_invite' });
    });

    it('binds a relay address', () => {
      expect(
        resolveOAuth(
          input({ intent: 'invite', profile: { ...verified, email: 'x@privaterelay.appleid.com' } }),
        ),
      ).toEqual({ kind: 'bind_invite' });
    });

    it('binds an identity with no email at all', () => {
      expect(
        resolveOAuth(input({ intent: 'invite', profile: { ...verified, email: null, emailVerified: false } })),
      ).toEqual({ kind: 'bind_invite' });
    });

    it('refuses a Google account that already belongs to someone', () => {
      expect(resolveOAuth(input({ intent: 'invite', knownIdentityUserId: BOB }))).toEqual({
        kind: 'refuse',
        reason: 'identity_in_use',
      });
    });

    it('ignores an email match: an invite never discovers by email', () => {
      expect(
        resolveOAuth(input({ intent: 'invite', emailCandidates: [{ userId: BOB, companyActive: true }] })),
      ).toEqual({ kind: 'bind_invite' });
    });
  });

  describe('link → bind to the signed-in user, no email comparison', () => {
    it('binds a new identity to whoever started the flow', () => {
      expect(
        resolveOAuth(input({ intent: 'link', stateUserId: ALICE, profile: { ...verified, email: 'z@z.com' } })),
      ).toEqual({ kind: 'link', userId: ALICE, alreadyLinked: false });
    });

    it('is idempotent when the identity is already theirs', () => {
      expect(resolveOAuth(input({ intent: 'link', stateUserId: ALICE, knownIdentityUserId: ALICE }))).toEqual({
        kind: 'link',
        userId: ALICE,
        alreadyLinked: true,
      });
    });

    it('refuses an identity that belongs to someone else', () => {
      expect(resolveOAuth(input({ intent: 'link', stateUserId: ALICE, knownIdentityUserId: BOB }))).toEqual({
        kind: 'refuse',
        reason: 'identity_in_use',
      });
    });

    it('refuses a link state that names no user', () => {
      expect(resolveOAuth(input({ intent: 'link', stateUserId: null }))).toEqual({
        kind: 'refuse',
        reason: 'invalid_state',
      });
    });
  });

  describe('auto-link by email — the narrow, dangerous path', () => {
    const candidate = { userId: ALICE, companyActive: true };

    it('links a verified address that matches exactly one active user', () => {
      expect(resolveOAuth(input({ emailCandidates: [candidate] }))).toEqual({
        kind: 'sign_in',
        userId: ALICE,
        viaEmail: true,
      });
    });

    it('does NOT link an unverified address — an attacker can mint one at a sloppy provider', () => {
      expect(
        resolveOAuth(input({ profile: { ...verified, emailVerified: false }, emailCandidates: [candidate] })),
      ).toEqual({ kind: 'register' });
    });

    it('does NOT link a relay address, even one the provider calls verified', () => {
      expect(
        resolveOAuth(
          input({
            profile: { ...verified, email: 'a@privaterelay.appleid.com' },
            emailCandidates: [candidate],
          }),
        ),
      ).toEqual({ kind: 'register' });
    });

    it('does NOT link a missing address', () => {
      expect(
        resolveOAuth(input({ profile: { ...verified, email: null }, emailCandidates: [candidate] })),
      ).toEqual({ kind: 'register' });
    });

    it('refuses rather than guesses when two companies have someone at that address', () => {
      expect(
        resolveOAuth(input({ emailCandidates: [candidate, { userId: BOB, companyActive: true }] })),
      ).toEqual({ kind: 'refuse', reason: 'ambiguous_email' });
    });

    it('refuses when the matching user’s company is not active', () => {
      expect(resolveOAuth(input({ emailCandidates: [{ userId: ALICE, companyActive: false }] }))).toEqual({
        kind: 'refuse',
        reason: 'account_unavailable',
      });
    });
  });

  describe('unknown identity, unknown email → offer to register a company', () => {
    it('offers registration, never silently joining anyone', () => {
      expect(resolveOAuth(input())).toEqual({ kind: 'register' });
    });

    it('offers registration for `register` too', () => {
      expect(resolveOAuth(input({ intent: 'register' }))).toEqual({ kind: 'register' });
    });
  });
});

describe('mayDiscoverByEmail', () => {
  const cases: Array<[OAuthIntent, OAuthProfile, boolean]> = [
    ['login', verified, true],
    ['register', verified, true],
    ['invite', verified, false],
    ['link', verified, false],
    ['login', { ...verified, emailVerified: false }, false],
    ['login', { ...verified, email: 'a@mozmail.com' }, false],
  ];

  it.each(cases)('%s with %j → %s', (intent, profile, expected) => {
    expect(mayDiscoverByEmail(intent, profile)).toBe(expected);
  });
});
