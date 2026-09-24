import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { FakeClock } from '#test/support/fake-clock.js';
import { loadConfig } from '#/config/load-config.js';
import { OAUTH_REGISTRATION_TTL_SECONDS, OAUTH_STATE_TTL_SECONDS } from '../auth.constants.js';
import { type OAuthState, OAuthStateService } from './oauth-state.service.js';

const SECRET = 'a'.repeat(32);
const START = new Date('2026-03-01T12:00:00.000Z');
const USER = '11111111-1111-4111-8111-111111111111';

function configWith(secret: string) {
  return loadConfig({
    DATABASE_URL: 'postgres://u:p@localhost:5432/gridline',
    DIRECT_URL: 'postgres://u:p@localhost:5432/gridline',
    JWT_ACCESS_SECRET: secret,
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  });
}

function setup() {
  const clock = new FakeClock(START);
  const jwt = new JwtService();
  return { clock, jwt, service: new OAuthStateService(jwt, configWith(SECRET), clock) };
}

const loginState = (nonce: string): OAuthState => ({ intent: 'login', nonce });

describe('OAuthStateService', () => {
  describe('state', () => {
    it('round-trips every intent', async () => {
      const { service } = setup();
      const nonce = service.newNonce();
      const states: OAuthState[] = [
        { intent: 'login', nonce },
        { intent: 'register', nonce },
        { intent: 'invite', nonce, inviteTokenHash: 'abc123' },
        { intent: 'link', nonce, userId: USER },
      ];
      for (const state of states) {
        expect(await service.verifyState(await service.signState(state))).toMatchObject(state);
      }
    });

    it('expires after its TTL, on the injected clock', async () => {
      const { service, clock } = setup();
      const token = await service.signState(loginState(service.newNonce()));

      clock.advance((OAUTH_STATE_TTL_SECONDS - 1) * 1000);
      expect(await service.verifyState(token)).not.toBeNull();

      clock.advance(2000);
      expect(await service.verifyState(token)).toBeNull();
    });

    it('rejects a tampered payload', async () => {
      const { service } = setup();
      const token = await service.signState(loginState(service.newNonce()));
      const [header, , signature] = token.split('.');
      const forged = Buffer.from(
        JSON.stringify({ intent: 'link', nonce: service.newNonce(), userId: USER, aud: 'gridline:oauth-state' }),
      ).toString('base64url');

      expect(await service.verifyState(`${header}.${forged}.${signature}`)).toBeNull();
    });

    it('rejects a token signed with another secret', async () => {
      const { service, clock, jwt } = setup();
      const other = new OAuthStateService(jwt, configWith('z'.repeat(32)), clock);
      const token = await other.signState(loginState(other.newNonce()));

      expect(await service.verifyState(token)).toBeNull();
    });

    it('rejects garbage', async () => {
      const { service } = setup();
      expect(await service.verifyState('not-a-jwt')).toBeNull();
      expect(await service.verifyState('')).toBeNull();
    });

    it('rejects an ACCESS token: the two are never interchangeable', async () => {
      const { service, jwt } = setup();
      const accessToken = await jwt.signAsync(
        { sub: USER },
        { secret: SECRET, algorithm: 'HS256', expiresIn: 900 },
      );

      expect(await service.verifyState(accessToken)).toBeNull();
    });

    it('rejects a correctly signed state that is missing what its intent requires', async () => {
      const { service } = setup();
      const token = await service.signState({
        intent: 'invite',
        nonce: service.newNonce(),
        inviteTokenHash: '',
      });

      expect(await service.verifyState(token)).toBeNull();
    });
  });

  describe('registration token', () => {
    const profile = { providerUserId: 'sub-1', email: 'a@acme.com', emailVerified: true, name: 'Alice' };

    it('round-trips a profile', async () => {
      const { service } = setup();
      expect(await service.verifyRegistration(await service.signRegistration(profile))).toMatchObject({
        sub: 'sub-1',
        email: 'a@acme.com',
        emailVerified: true,
        name: 'Alice',
      });
    });

    it('expires after its TTL', async () => {
      const { service, clock } = setup();
      const token = await service.signRegistration(profile);

      clock.advance((OAUTH_REGISTRATION_TTL_SECONDS + 1) * 1000);
      expect(await service.verifyRegistration(token)).toBeNull();
    });

    it('cannot be replayed as a state, nor a state as a registration', async () => {
      const { service } = setup();
      const registration = await service.signRegistration(profile);
      const state = await service.signState(loginState(service.newNonce()));

      expect(await service.verifyState(registration)).toBeNull();
      expect(await service.verifyRegistration(state)).toBeNull();
    });
  });

  describe('nonceMatches', () => {
    it('accepts equal nonces only', () => {
      expect(OAuthStateService.nonceMatches('abcdefabcdefabcdef', 'abcdefabcdefabcdef')).toBe(true);
      expect(OAuthStateService.nonceMatches('abcdefabcdefabcdef', 'abcdefabcdefabcdeg')).toBe(false);
    });

    it('rejects a missing cookie and a different length without throwing', () => {
      expect(OAuthStateService.nonceMatches('abcdefabcdefabcdef', undefined)).toBe(false);
      expect(OAuthStateService.nonceMatches('abcdefabcdefabcdef', '')).toBe(false);
      expect(OAuthStateService.nonceMatches('abcdefabcdefabcdef', 'short')).toBe(false);
    });
  });
});
