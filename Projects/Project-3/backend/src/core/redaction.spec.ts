import { describe, expect, it } from 'vitest';
import { REDACT_CENSOR, REDACT_KEYS, REDACT_PINO_PATHS, maskOneTimeQuery } from './redaction.js';

describe('redaction', () => {
  it('scrubs every one-time link and token an email or auth flow carries', () => {
    for (const key of [
      'activationUrl',
      'inviteUrl',
      'resetUrl',
      'inviteToken',
      'resetToken',
      'activationToken',
      'exchangeCode',
    ]) {
      expect(REDACT_KEYS, key).toContain(key);
    }
  });

  it('still scrubs credentials in general', () => {
    for (const key of [
      'password',
      'refreshToken',
      'accessToken',
      'apiKey',
      'keyHash',
      'authorization',
      'cookie',
      'secret',
      'encryptedSecret',
      'secretIv',
      'secretTag',
      'DATA_ENCRYPTION_KEY',
    ]) {
      expect(REDACT_KEYS, key).toContain(key);
    }
  });

  it('does NOT scrub `code`: error codes (a Postgres 23505, ECONNREFUSED) are what a log reader needs', () => {
    expect(REDACT_KEYS).not.toContain('code');
  });

  it('derives pino’s paths from the same list, at the top level and one level down', () => {
    for (const key of REDACT_KEYS) {
      expect(REDACT_PINO_PATHS).toContain(key);
      expect(REDACT_PINO_PATHS).toContain(`*.${key}`);
    }
    expect(REDACT_PINO_PATHS).toContain('req.headers.authorization');
  });

  describe('maskOneTimeQuery', () => {
    it('hides the value of a one-time token in the logged address and keeps the rest', () => {
      expect(maskOneTimeQuery('/auth/activate?token=QREpAgjkpit1Tajxh5PH&next=%2Ffiles')).toBe(`/auth/activate?token=${REDACT_CENSOR}&next=%2Ffiles`);
      expect(maskOneTimeQuery('/x?a=1&code=abc&state=def')).toBe(`/x?a=1&code=${REDACT_CENSOR}&state=${REDACT_CENSOR}`);
    });

    it('leaves addresses without one alone, and does not touch look-alike names', () => {
      expect(maskOneTimeQuery('/files?limit=5&cursor=abc')).toBe('/files?limit=5&cursor=abc');
      expect(maskOneTimeQuery('/x?mytoken=1&encoded=2')).toBe('/x?mytoken=1&encoded=2');
    });

    it('is also asked of the parsed query, by path', () => {
      expect(REDACT_PINO_PATHS).toContain('req.query.token');
    });
  });
});
