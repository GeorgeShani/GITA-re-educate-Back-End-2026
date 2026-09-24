import { describe, expect, it } from 'vitest';
import { formatCents } from './invoicing.service.js';

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [5, '$0.05'],
    [50, '$0.50'],
    [339, '$3.39'],
    [30_000, '$300.00'],
    [32_050, '$320.50'],
    [123_456_789, '$1,234,567.89'],
    [-250, '-$2.50'],
  ])('%i cents → %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });
});
