import { describe, expect, it } from 'vitest';
import { appLink } from '../app-link.js';
import { PasswordHasher } from './password-hasher.js';
import { TokenFactory } from './token-factory.js';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher();

  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hasher.hash('correct-horse-battery');

    expect(await hasher.verify('correct-horse-battery', stored)).toBe(true);
    expect(await hasher.verify('correct-horse-batterY', stored)).toBe(false);
    expect(await hasher.verify('', stored)).toBe(false);
  });

  it('never stores the password and salts every hash', async () => {
    const a = await hasher.hash('same-password');
    const b = await hasher.hash('same-password');

    expect(a).not.toContain('same-password');
    expect(a).not.toBe(b);
    expect(await hasher.verify('same-password', a)).toBe(true);
    expect(await hasher.verify('same-password', b)).toBe(true);
  });

  it('is self-describing, so the cost can be raised later', async () => {
    const [scheme, n, r, p] = (await hasher.hash('x')).split('$');

    expect([scheme, n, r, p]).toEqual(['scrypt', '16384', '8', '1']);
  });

  it.each([
    ['empty', ''],
    ['not our format', 'bcrypt$whatever'],
    ['too few parts', 'scrypt$16384$8$1$abc'],
    ['non-numeric cost', 'scrypt$x$8$1$YWJj$YWJj'],
    ['empty hash', 'scrypt$16384$8$1$YWJj$'],
  ])('treats a malformed stored hash (%s) as a non-match rather than throwing', async (_name, stored) => {
    expect(await hasher.verify('anything', stored)).toBe(false);
  });

  it('refuses absurd cost parameters instead of allocating for them', async () => {
    // A corrupt or hostile row must not be able to make scrypt ask for gigabytes.
    const started = Date.now();

    expect(await hasher.verify('x', 'scrypt$1073741824$8$1$YWJj$YWJj')).toBe(false);
    expect(await hasher.verify('x', 'scrypt$16384$1024$1$YWJj$YWJj')).toBe(false);
    expect(Date.now() - started).toBeLessThan(1_000);
  });

  it('verifyDummy always returns false but does real work', async () => {
    const started = Date.now();

    expect(await hasher.verifyDummy('whatever')).toBe(false);
    // One scrypt verification is tens of milliseconds; a no-op would be ~0.
    expect(Date.now() - started).toBeGreaterThan(5);
  });
});

describe('TokenFactory', () => {
  const factory = new TokenFactory();

  it('issues unguessable, unique, URL-safe tokens', () => {
    const tokens = Array.from({ length: 50 }, () => factory.issue().plaintext);

    expect(new Set(tokens).size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('stores only a hash, and the hash is reproducible from the plaintext', () => {
    const { plaintext, hash } = factory.issue();

    expect(hash).not.toContain(plaintext);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(factory.hash(plaintext)).toBe(hash);
    expect(factory.hash(`${plaintext}x`)).not.toBe(hash);
  });
});

describe('appLink', () => {
  it('builds the link from the public origin', () => {
    expect(appLink('https://gridline.test', '/activate', 'abc')).toBe(
      'https://gridline.test/activate?token=abc',
    );
  });

  it('is not thrown by a trailing slash on the origin', () => {
    expect(appLink('https://gridline.test/', '/activate', 'abc')).toBe(
      'https://gridline.test/activate?token=abc',
    );
  });

  it('percent-encodes the token', () => {
    expect(appLink('http://localhost:3000', '/reset-password', 'a b&c=d')).toBe(
      'http://localhost:3000/reset-password?token=a+b%26c%3Dd',
    );
  });
});
