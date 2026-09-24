import { describe, expect, it } from 'vitest';
import { contactFromProfile, isRelayAddress } from './relay-address.js';

describe('isRelayAddress', () => {
  it.each([
    'abc123@privaterelay.appleid.com',
    'x@PrivateRelay.AppleID.com',
    'x@relay.firefox.com',
    'x@mozmail.com',
    'alias@sub.simplelogin.com',
    'me@duck.com',
  ])('flags %s', (email) => {
    expect(isRelayAddress(email)).toBe(true);
  });

  it.each(['giorgi@gmail.com', 'nino@acme.com', 'x@notduck.com', 'x@privaterelay.appleid.com.example.org'])(
    'does not flag %s',
    (email) => {
      expect(isRelayAddress(email)).toBe(false);
    },
  );
});

describe('contactFromProfile', () => {
  it('trusts a verified ordinary address, normalised', () => {
    expect(contactFromProfile({ email: '  Nino@Acme.COM ', emailVerified: true })).toEqual({
      email: 'nino@acme.com',
      verified: true,
    });
  });

  it('keeps an unverified address but never calls it verified', () => {
    expect(contactFromProfile({ email: 'nino@acme.com', emailVerified: false })).toEqual({
      email: 'nino@acme.com',
      verified: false,
    });
  });

  it('drops a relay address entirely, even when the provider says it is verified', () => {
    expect(contactFromProfile({ email: 'x@privaterelay.appleid.com', emailVerified: true })).toEqual({
      email: null,
      verified: false,
    });
  });

  it('handles a provider that gave no address', () => {
    expect(contactFromProfile({ email: null, emailVerified: false })).toEqual({
      email: null,
      verified: false,
    });
  });
});
