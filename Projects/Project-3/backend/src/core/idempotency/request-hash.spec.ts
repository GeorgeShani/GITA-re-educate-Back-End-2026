import { describe, expect, it } from 'vitest';
import { canonicalJson, hashRequest } from './request-hash.js';

const base = { method: 'POST', path: '/files', userId: 'u1', body: { visibility: 'company' } };

describe('canonicalJson', () => {
  it('ignores key order at every depth', () => {
    expect(canonicalJson({ a: 1, b: { c: 2, d: 3 } })).toBe(canonicalJson({ b: { d: 3, c: 2 }, a: 1 }));
  });

  it('keeps array order, which is meaningful', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it('treats an undefined property as absent', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

describe('hashRequest', () => {
  it('is stable for the same request', () => {
    expect(hashRequest(base)).toBe(hashRequest({ ...base }));
  });

  it.each([
    ['method', { method: 'PATCH' }],
    ['path', { path: '/files/1' }],
    ['caller', { userId: 'u2' }],
    ['body', { body: { visibility: 'restricted' } }],
  ])('changes with the %s', (_name, override) => {
    expect(hashRequest({ ...base, ...override })).not.toBe(hashRequest(base));
  });

  it('covers the file bytes: one changed byte is a different request', () => {
    const a = hashRequest({ ...base, file: Buffer.from('a,b\n1,2\n') });
    const b = hashRequest({ ...base, file: Buffer.from('a,b\n1,3\n') });

    expect(a).not.toBe(b);
    expect(a).not.toBe(hashRequest(base));
  });

  it('cannot be confused by moving content between the body and the file', () => {
    expect(hashRequest({ ...base, body: 'x', file: Buffer.from('y') })).not.toBe(
      hashRequest({ ...base, body: 'xy' }),
    );
  });
});
