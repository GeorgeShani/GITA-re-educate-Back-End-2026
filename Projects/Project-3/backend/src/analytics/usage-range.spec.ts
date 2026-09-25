import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { eachDay, resolveRange } from './usage-range.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const MARCH = { start: day('2026-03-01'), end: day('2026-04-01') };

describe('resolveRange', () => {
  it('defaults to the current billing period so far: its first day through today', () => {
    const range = resolveRange({}, MARCH, new Date('2026-03-05T12:00:00Z'));

    expect(range).toEqual({ from: day('2026-03-01'), to: day('2026-03-06'), days: 5 });
  });

  it('on the period’s first day it is that one day', () => {
    expect(resolveRange({}, MARCH, new Date('2026-03-01T00:00:01Z')).days).toBe(1);
  });

  it('never runs past the end of the period', () => {
    const range = resolveRange({}, MARCH, new Date('2026-03-31T23:59:00Z'));
    expect(range.to).toEqual(day('2026-04-01'));
    expect(range.days).toBe(31);
  });

  it('reads both ends as UTC days and drops any time of day', () => {
    const range = resolveRange(
      { from: new Date('2026-03-02T23:30:00Z'), to: new Date('2026-03-04T01:00:00Z') },
      MARCH,
      new Date('2026-03-10T00:00:00Z'),
    );
    expect(range).toEqual({ from: day('2026-03-02'), to: day('2026-03-04'), days: 2 });
  });

  it('takes an explicit `from` alone, through today', () => {
    const range = resolveRange({ from: day('2026-03-03') }, MARCH, new Date('2026-03-05T12:00:00Z'));
    expect(range).toEqual({ from: day('2026-03-03'), to: day('2026-03-06'), days: 3 });
  });

  it('takes an explicit `to` alone, from the period start', () => {
    const range = resolveRange({ to: day('2026-03-10') }, MARCH, new Date('2026-03-20T00:00:00Z'));
    expect(range).toEqual({ from: day('2026-03-01'), to: day('2026-03-10'), days: 9 });
  });

  it('can look at any past window, not only the current period', () => {
    const range = resolveRange({ from: day('2025-01-01'), to: day('2025-02-01') }, MARCH, new Date('2026-03-05T00:00:00Z'));
    expect(range.days).toBe(31);
  });

  it.each([
    ['an empty range', { from: day('2026-03-05'), to: day('2026-03-05') }],
    ['a backwards range', { from: day('2026-03-05'), to: day('2026-03-01') }],
    ['`to` earlier the same day as `from`', { from: new Date('2026-03-05T20:00:00Z'), to: new Date('2026-03-05T21:00:00Z') }],
  ])('rejects %s', (_name, requested) => {
    expect(() => resolveRange(requested, MARCH, new Date('2026-03-10T00:00:00Z'))).toThrow(BadRequestException);
  });

  it('allows exactly 366 days and refuses 367', () => {
    const now = new Date('2026-03-10T00:00:00Z');
    expect(resolveRange({ from: day('2025-03-01'), to: day('2026-03-02') }, MARCH, now).days).toBe(366);
    expect(() => resolveRange({ from: day('2025-03-01'), to: day('2026-03-03') }, MARCH, now)).toThrow(/367 days/);
  });
});

describe('eachDay', () => {
  it('lists every UTC day of the range', () => {
    expect(eachDay({ from: day('2026-02-27'), to: day('2026-03-02'), days: 3 })).toEqual([
      '2026-02-27',
      '2026-02-28',
      '2026-03-01',
    ]);
  });

  it('is exact across a leap day', () => {
    expect(eachDay({ from: day('2028-02-28'), to: day('2028-03-01'), days: 2 })).toEqual(['2028-02-28', '2028-02-29']);
  });
});
