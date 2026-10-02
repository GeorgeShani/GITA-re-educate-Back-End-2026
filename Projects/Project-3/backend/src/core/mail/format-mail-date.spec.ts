import { describe, expect, it } from 'vitest';
import { formatMailDate } from './format-mail-date.js';

describe('formatMailDate', () => {
  it('says the UTC day in words', () => {
    expect(formatMailDate(new Date('2026-03-08T00:00:00.000Z'))).toBe('March 8, 2026');
  });

  it('does not shift a late-evening UTC instant into the next day', () => {
    expect(formatMailDate(new Date('2026-12-31T23:59:59.000Z'))).toBe('December 31, 2026');
  });
});
