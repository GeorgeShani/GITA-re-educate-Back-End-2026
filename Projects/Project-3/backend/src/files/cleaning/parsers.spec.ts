import { describe, expect, it } from 'vitest';
import { parseDate, parseNumber } from './parsers.js';

const day = (text: string, order: 'dmy' | 'mdy' = 'dmy') => parseDate(text, order)?.date.toISOString().slice(0, 10) ?? null;

describe('parseDate', () => {
  it.each([
    ['2026-03-04', '2026-03-04'],
    ['2026-03-04T00:00:00Z', '2026-03-04'],
    ['2026-03-04 00:00:00', '2026-03-04'],
    ['4 Mar 2026', '2026-03-04'],
    ['March 4, 2026', '2026-03-04'],
    ['Mar 4 2026', '2026-03-04'],
    ['4 March 2026', '2026-03-04'],
    ['25/12/2025', '2025-12-25'],
    ['12/25/2025', '2025-12-25'],
    ['31.01.2026', '2026-01-31'],
    ['1-2-2026', '2026-02-01'],
  ])('reads %s as %s', (text, expected) => {
    expect(day(text)).toBe(expected);
  });

  it('keeps a time of day when there is one', () => {
    expect(parseDate('2026-03-04T10:30:00Z', 'dmy')?.date.toISOString()).toBe('2026-03-04T10:30:00.000Z');
  });

  it('reads 03/04/2026 by the order it is told, and says it could have been either', () => {
    expect(parseDate('03/04/2026', 'dmy')).toMatchObject({ ambiguous: true });
    expect(day('03/04/2026', 'dmy')).toBe('2026-04-03');
    expect(day('03/04/2026', 'mdy')).toBe('2026-03-04');
  });

  it('is not ambiguous when the two numbers are equal, or one cannot be a month', () => {
    expect(parseDate('05/05/2026', 'dmy')?.ambiguous).toBe(false);
    expect(parseDate('13/04/2026', 'mdy')?.ambiguous).toBe(false);
    expect(day('13/04/2026', 'mdy')).toBe('2026-04-13');
  });

  it.each(['31/02/2026', '2026-02-30', '00/01/2026', '32/01/2026', '4/3/26', 'yesterday', '', '2026', '12 Foo 2026'])(
    'does not guess at %j',
    (text) => {
      expect(parseDate(text, 'dmy')).toBeNull();
    },
  );
});

describe('parseNumber', () => {
  it.each([
    ['1234', '.', 1234],
    ['1,234.50', '.', 1234.5],
    ['$1,234.50', '.', 1234.5],
    ['1.234,50 €', ',', 1234.5],
    ['1 234,5', ',', 1234.5],
    ['1 234,5', ',', 1234.5],
    ['-12,5', ',', -12.5],
    ['(2,000)', '.', -2000],
    ['+7', '.', 7],
    ['EUR 10,5', ',', 10.5],
    ['0,5', ',', 0.5],
  ] as const)('reads %j (decimal %s) as %d', (text, decimal, expected) => {
    expect(parseNumber(text, decimal)).toBe(expected);
  });

  it.each([
    ['12%', '.'],
    ['1,23', '.'],
    ['1.2.3', '.'],
    ['12-14', '.'],
    ['ten', '.'],
    ['', '.'],
    ['1,234,5', '.'],
    ['1.234.5', ','],
  ] as const)('does not vouch for %j', (text, decimal) => {
    expect(parseNumber(text, decimal)).toBeNull();
  });
});
