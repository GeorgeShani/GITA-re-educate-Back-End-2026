import { describe, expect, it } from 'vitest';
import {
  API_KEY_FORMAT,
  effectiveScopes,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  scopesAllowedFor,
} from './api-key-token.js';

describe('generateApiKey', () => {
  it('produces gl_live_<8 hex>_<secret> whose prefix is its own first part', () => {
    const { plaintext, prefix } = generateApiKey();
    expect(plaintext).toMatch(API_KEY_FORMAT);
    expect(plaintext.startsWith(`${prefix}_`)).toBe(true);
    expect(prefix).toMatch(/^gl_live_[0-9a-f]{8}$/);
  });

  it('stores the SHA-256 of the whole token, never the token', () => {
    const { plaintext, hash } = generateApiKey();
    expect(hash).toBe(hashApiKey(plaintext));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(plaintext);
  });

  it('is unique per call', () => {
    const seen = new Set(Array.from({ length: 200 }, () => generateApiKey().plaintext));
    expect(seen.size).toBe(200);
  });
});

describe('looksLikeApiKey / API_KEY_FORMAT', () => {
  it('routes on the prefix, and validates the whole shape separately', () => {
    expect(looksLikeApiKey('gl_live_anything')).toBe(true);
    expect(looksLikeApiKey('eyJhbGciOi.a.b')).toBe(false);
    expect(API_KEY_FORMAT.test('gl_live_anything')).toBe(false);
    expect(API_KEY_FORMAT.test(`gl_live_ab12cd34_${'A'.repeat(42)}`)).toBe(false);
    expect(API_KEY_FORMAT.test(`gl_live_AB12CD34_${'A'.repeat(43)}`)).toBe(false);
    expect(API_KEY_FORMAT.test(`gl_live_ab12cd34_${'A'.repeat(43)}\n`)).toBe(false);
  });
});

describe('scopes by role', () => {
  it('an admin may grant everything; an employee never billing:read', () => {
    expect(scopesAllowedFor('admin')).toEqual(['files:read', 'files:write', 'billing:read']);
    expect(scopesAllowedFor('employee')).toEqual(['files:read', 'files:write']);
  });

  it('narrows a key’s granted scopes by the creator’s CURRENT role', () => {
    const granted = ['files:read', 'billing:read'] as const;
    expect(effectiveScopes('admin', granted)).toEqual(['files:read', 'billing:read']);
    // Demoted admin: the billing scope on the key stops counting.
    expect(effectiveScopes('employee', granted)).toEqual(['files:read']);
  });
});
