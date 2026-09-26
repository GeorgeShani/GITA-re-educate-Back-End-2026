import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('cursor codec', () => {
  it('round-trips createdAt and id exactly', () => {
    const original = { createdAt: new Date('2026-01-01T00:00:00.000Z'), id: 'abc-123' };

    const decoded = decodeCursor(encodeCursor(original));

    expect(decoded.createdAt.toISOString()).toBe(original.createdAt.toISOString());
    expect(decoded.id).toBe(original.id);
  });

  it('produces an opaque, non-guessable string — not raw JSON', () => {
    const encoded = encodeCursor({ createdAt: new Date(), id: 'x' });
    expect(encoded).not.toContain('{');
    expect(encoded).not.toContain('createdAt');
  });

  it('rejects garbage input rather than returning a nonsense date', () => {
    expect(() => decodeCursor('not-a-real-cursor')).toThrow(BadRequestException);
  });

  it('rejects a well-formed-but-incomplete payload', () => {
    const missingId = Buffer.from('2026-01-01T00:00:00.000Z', 'utf8').toString('base64url');
    expect(() => decodeCursor(missingId)).toThrow(BadRequestException);
  });

  it('rejects a payload with an unparsable date', () => {
    const badDate = Buffer.from('not-a-date|some-id', 'utf8').toString('base64url');
    expect(() => decodeCursor(badDate)).toThrow(BadRequestException);
  });
});
