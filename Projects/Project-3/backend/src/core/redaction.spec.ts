import { describe, expect, it } from 'vitest';
import { REDACT_KEYS, REDACT_PINO_PATHS } from './redaction.js';

describe('redaction', () => {
  it('scrubs every one-time link and token an email or auth flow carries', () => {
    for (const key of ['activationUrl', 'inviteUrl', 'resetUrl', 'inviteToken', 'resetToken', 'activationToken', 'exchangeCode']) {
      expect(REDACT_KEYS, key).toContain(key);
    }
  });

  it('still scrubs credentials in general', () => {
    for (const key of ['password', 'refreshToken', 'accessToken', 'apiKey', 'keyHash', 'authorization', 'cookie']) {
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
});
