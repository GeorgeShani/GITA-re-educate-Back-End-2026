import { describe, expect, it } from 'vitest';
import {
  type Period,
  daysIn,
  nextPeriod,
  openPeriodAt,
  periodFor,
  periodKey,
  startOfUtcDay,
} from './period.js';

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const range = (period: Period) => [
  period.start.toISOString().slice(0, 10),
  period.end.toISOString().slice(0, 10),
];

describe('periodFor', () => {
  it('anchor 1 is the calendar month', () => {
    expect(range(periodFor(1, new Date('2026-03-15T10:00:00Z')))).toEqual(['2026-03-01', '2026-04-01']);
  });

  it('is half-open: the anchor instant starts the NEW period', () => {
    expect(range(periodFor(15, new Date('2026-03-14T23:59:59.999Z')))).toEqual(['2026-02-15', '2026-03-15']);
    expect(range(periodFor(15, new Date('2026-03-15T00:00:00.000Z')))).toEqual(['2026-03-15', '2026-04-15']);
    expect(range(periodFor(15, new Date('2026-03-15T23:59:59.999Z')))).toEqual(['2026-03-15', '2026-04-15']);
  });

  describe('clamps a long anchor into short months, each month independently', () => {
    it.each([
      // anchor, instant, expected [start, end)
      [31, '2026-01-31', ['2026-01-31', '2026-02-28']],
      [31, '2026-02-10', ['2026-01-31', '2026-02-28']],
      [31, '2026-02-28', ['2026-02-28', '2026-03-31']],
      [31, '2026-03-31', ['2026-03-31', '2026-04-30']],
      [31, '2026-04-30', ['2026-04-30', '2026-05-31']],
      [31, '2026-05-31', ['2026-05-31', '2026-06-30']],
      // Leap year: Feb has 29 days, so the clamp lands on the 29th.
      [31, '2028-02-10', ['2028-01-31', '2028-02-29']],
      [31, '2028-02-29', ['2028-02-29', '2028-03-31']],
      [30, '2026-02-15', ['2026-01-30', '2026-02-28']],
      [30, '2028-02-15', ['2028-01-30', '2028-02-29']],
      [29, '2026-02-28', ['2026-02-28', '2026-03-29']],
      [29, '2028-02-29', ['2028-02-29', '2028-03-29']],
      // Year boundaries, both directions.
      [31, '2026-12-31', ['2026-12-31', '2027-01-31']],
      [31, '2027-01-05', ['2026-12-31', '2027-01-31']],
      [31, '2027-01-31', ['2027-01-31', '2027-02-28']],
    ] as const)('anchor %i at %s', (anchor, instant, expected) => {
      expect(range(periodFor(anchor, d(instant)))).toEqual(expected);
    });

    it('never drifts: anchor 31 returns to the 31st after a short month', () => {
      const feb = periodFor(31, d('2026-02-10'));
      const march = nextPeriod(31, feb);
      const april = nextPeriod(31, march);

      expect(range(feb)).toEqual(['2026-01-31', '2026-02-28']);
      expect(range(march)).toEqual(['2026-02-28', '2026-03-31']);
      expect(range(april)).toEqual(['2026-03-31', '2026-04-30']);
    });
  });

  it.each([0, 32, -1, 1.5, Number.NaN])('rejects the invalid anchor %s', (anchor) => {
    expect(() => periodFor(anchor, d('2026-03-01'))).toThrow(RangeError);
  });
});

describe('a chain of periods, for every possible anchor day', () => {
  it.each(Array.from({ length: 31 }, (_, index) => index + 1))(
    'anchor %i: 60 consecutive periods are contiguous, day-aligned and 28–31 days long',
    (anchor) => {
      let period = periodFor(anchor, d('2027-01-15'));

      for (let step = 0; step < 60; step += 1) {
        const following = nextPeriod(anchor, period);

        // No gap and no overlap: every period starts exactly where the last ended.
        expect(following.start.getTime()).toBe(period.end.getTime());
        expect(period.start.getTime()).toBeLessThan(period.end.getTime());
        // UTC midnight on both ends, so proration is whole-day integer maths.
        expect(period.start.getTime() % 86_400_000).toBe(0);
        expect(period.end.getTime() % 86_400_000).toBe(0);
        expect(daysIn(period)).toBeGreaterThanOrEqual(28);
        expect(daysIn(period)).toBeLessThanOrEqual(31);
        // The day of the month is the anchor, or the month's last day if shorter.
        expect(period.start.getUTCDate()).toBeLessThanOrEqual(anchor);

        period = following;
      }
    },
  );

  it('every instant belongs to exactly the period periodFor names', () => {
    const anchor = 31;
    for (let day = 0; day < 800; day += 7) {
      const instant = new Date(d('2026-01-01').getTime() + day * 86_400_000 + 12 * 3_600_000);
      const period = periodFor(anchor, instant);

      expect(instant.getTime()).toBeGreaterThanOrEqual(period.start.getTime());
      expect(instant.getTime()).toBeLessThan(period.end.getTime());
    }
  });
});

describe('helpers', () => {
  it('daysIn counts whole days', () => {
    expect(daysIn(periodFor(1, d('2026-02-10')))).toBe(28);
    expect(daysIn(periodFor(1, d('2028-02-10')))).toBe(29);
    expect(daysIn(periodFor(1, d('2026-04-10')))).toBe(30);
    expect(daysIn(periodFor(1, d('2026-03-10')))).toBe(31);
  });

  it('periodKey is the start date', () => {
    expect(periodKey(periodFor(15, d('2026-03-20')))).toBe('2026-03-15');
  });

  it('startOfUtcDay drops the time', () => {
    expect(startOfUtcDay(new Date('2026-03-11T23:59:59.999Z')).toISOString()).toBe('2026-03-11T00:00:00.000Z');
  });

  describe('openPeriodAt — the first period of an activation or plan change (D6)', () => {
    it('starts at UTC midnight of that day and anchors to its day of the month', () => {
      const { period, anchorDay } = openPeriodAt(new Date('2026-03-11T09:30:00Z'));

      expect(anchorDay).toBe(11);
      expect(range(period)).toEqual(['2026-03-11', '2026-04-11']);
    });

    it('anchoring on the 31st gives a short first period into February', () => {
      const { period, anchorDay } = openPeriodAt(new Date('2026-01-31T15:00:00Z'));

      expect(anchorDay).toBe(31);
      expect(range(period)).toEqual(['2026-01-31', '2026-02-28']);
    });

    it('anchoring on the 28th of February keeps 28, not 31', () => {
      const { period, anchorDay } = openPeriodAt(new Date('2026-02-28T00:00:00Z'));

      expect(anchorDay).toBe(28);
      expect(range(period)).toEqual(['2026-02-28', '2026-03-28']);
    });
  });
});
