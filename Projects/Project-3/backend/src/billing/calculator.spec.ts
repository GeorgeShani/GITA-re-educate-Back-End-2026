import { describe, expect, it } from 'vitest';
import type { Plan } from '#/subscriptions/plan-catalog.js';
import { type SeatInterval, computeLineItems, divRound } from './calculator.js';
import { type Period, periodFor } from './period.js';

const d = (iso: string) => new Date(iso.includes('T') ? iso : `${iso}T00:00:00.000Z`);

/** March 2026: [Mar 1, Apr 1) — 31 days. */
const MARCH: Period = periodFor(1, d('2026-03-10'));
/** February 2026: 28 days. */
const FEBRUARY: Period = periodFor(1, d('2026-02-10'));

function seat(userId: string, from: string, to: string | null): SeatInterval {
  return { userId, from: d(from), to: to === null ? null : d(to) };
}

function statement(
  plan: Plan,
  overrides: Partial<Parameters<typeof computeLineItems>[0]> = {},
) {
  return computeLineItems({
    plan,
    period: MARCH,
    seatIntervals: [],
    filesThisPeriod: 0,
    ...overrides,
  });
}

describe('divRound', () => {
  it('rounds half up, exactly', () => {
    expect(divRound(1, 2)).toBe(1);
    expect(divRound(1, 3)).toBe(0);
    expect(divRound(2, 3)).toBe(1);
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(0, 7)).toBe(0);
  });

  it('is exact where floating point is not', () => {
    // 500 * 17 / 28 = 303.571… — and a case where n/d is exactly x.5.
    expect(divRound(500 * 17, 28)).toBe(304);
    expect(divRound(3, 2)).toBe(2);
    expect(divRound(1_000_003, 2)).toBe(500_002);
  });
});

describe('free', () => {
  it('has no line items whatever the inputs', () => {
    const result = statement('free', {
      seatIntervals: [seat('u1', '2026-01-01', null)],
      filesThisPeriod: 500,
    });

    expect(result).toEqual({ lineItems: [], totalCents: 0 });
  });
});

describe('basic — $5 per employee, prorated by active days', () => {
  it('bills nothing with no employees', () => {
    expect(statement('basic')).toEqual({ lineItems: [], totalCents: 0 });
  });

  it('bills the full $5 for an employee active the whole period', () => {
    const result = statement('basic', { seatIntervals: [seat('u1', '2026-02-01', null)] });

    expect(result.totalCents).toBe(500);
    expect(result.lineItems).toEqual([
      expect.objectContaining({ kind: 'seat', userId: 'u1', activeDays: 31, periodDays: 31, amountCents: 500 }),
    ]);
  });

  it('never bills a flat $5 for a mid-period join — it is days ÷ period', () => {
    // Active from Mar 11: 21 of 31 days -> 500 * 21 / 31 = 338.7 -> 339.
    const result = statement('basic', { seatIntervals: [seat('u1', '2026-03-11', null)] });

    expect(result.lineItems[0]).toMatchObject({ activeDays: 21, amountCents: 339 });
  });

  it('a soft-disable stops the charge on the disable day (half-open)', () => {
    // [Mar 1, Mar 11): 10 days -> 161.29 -> 161.
    const result = statement('basic', { seatIntervals: [seat('u1', '2026-02-01', '2026-03-11')] });

    expect(result.lineItems[0]).toMatchObject({ activeDays: 10, amountCents: 161 });
  });

  it('reads the day, not the time of day', () => {
    const late = statement('basic', {
      seatIntervals: [{ userId: 'u1', from: d('2026-03-11T23:59:59Z'), to: null }],
    });
    const early = statement('basic', {
      seatIntervals: [{ userId: 'u1', from: d('2026-03-11T00:00:01Z'), to: null }],
    });

    expect(late.totalCents).toBe(early.totalCents);
    expect(late.lineItems[0]).toMatchObject({ activeDays: 21 });
  });

  describe('seat intervals relative to the period', () => {
    it('entirely inside', () => {
      const result = statement('basic', { seatIntervals: [seat('u1', '2026-03-10', '2026-03-20')] });

      expect(result.lineItems[0]).toMatchObject({ activeDays: 10 });
    });

    it('straddling the start is clipped to the period', () => {
      // Active Feb 20 -> Mar 6: only Mar 1..5 (5 days) fall in March.
      const result = statement('basic', { seatIntervals: [seat('u1', '2026-02-20', '2026-03-06')] });

      expect(result.lineItems[0]).toMatchObject({ activeDays: 5, amountCents: 81 });
    });

    it('straddling the end is clipped to the period', () => {
      // Active Mar 20 -> Apr 10: Mar 20..31 (12 days).
      const result = statement('basic', { seatIntervals: [seat('u1', '2026-03-20', '2026-04-10')] });

      expect(result.lineItems[0]).toMatchObject({ activeDays: 12, amountCents: 194 });
    });

    it('spanning the whole period is one full charge', () => {
      const result = statement('basic', { seatIntervals: [seat('u1', '2026-01-01', '2026-06-01')] });

      expect(result.lineItems[0]).toMatchObject({ activeDays: 31, amountCents: 500 });
    });

    it.each([
      ['entirely before', seat('u1', '2026-01-01', '2026-02-01')],
      ['ending exactly when the period starts', seat('u1', '2026-01-01', '2026-03-01')],
      ['entirely after', seat('u1', '2026-05-01', null)],
      ['starting exactly when the period ends', seat('u1', '2026-04-01', null)],
    ])('%s produces no line at all', (_name, interval) => {
      expect(statement('basic', { seatIntervals: [interval] })).toEqual({
        lineItems: [],
        totalCents: 0,
      });
    });
  });

  it('a same-day add-then-remove costs nothing', () => {
    const result = statement('basic', {
      seatIntervals: [{ userId: 'u1', from: d('2026-03-10T09:00:00Z'), to: d('2026-03-10T17:00:00Z') }],
    });

    expect(result).toEqual({ lineItems: [], totalCents: 0 });
  });

  it('a disable-then-reactivate is two intervals, each billed for its own days', () => {
    // Active Mar 1..10 (9 days), off Mar 10..20, active again Mar 20.. (12 days).
    const result = statement('basic', {
      seatIntervals: [seat('u1', '2026-01-01', '2026-03-10'), seat('u1', '2026-03-20', null)],
    });

    expect(result.lineItems.map((line) => line.kind === 'seat' && line.activeDays)).toEqual([9, 12]);
    expect(result.totalCents).toBe(divRound(500 * 9, 31) + divRound(500 * 12, 31));
  });

  it('caps at $50 with the full 10 employees for a full period', () => {
    const employees = Array.from({ length: 10 }, (_, index) => seat(`u${index}`, '2026-01-01', null));

    expect(statement('basic', { seatIntervals: employees }).totalCents).toBe(5000);
  });

  it('uses the actual length of the period as the denominator', () => {
    // 14 of 28 days in February is exactly half.
    const result = statement('basic', {
      period: FEBRUARY,
      seatIntervals: [seat('u1', '2026-02-15', null)],
    });

    expect(result.lineItems[0]).toMatchObject({ activeDays: 14, periodDays: 28, amountCents: 250 });
  });

  it('adds one line per employee and totals them', () => {
    const result = statement('basic', {
      seatIntervals: [seat('u1', '2026-01-01', null), seat('u2', '2026-03-16', null)],
    });

    expect(result.lineItems).toHaveLength(2);
    expect(result.totalCents).toBe(500 + divRound(500 * 16, 31));
  });

  it('does not bill overage — Basic blocks instead', () => {
    expect(statement('basic', { filesThisPeriod: 5_000 }).lineItems).toEqual([]);
  });
});

describe('premium — $300 + $0.50 per file over 1000', () => {
  it('is a flat $300 with no overage', () => {
    const result = statement('premium', { filesThisPeriod: 12 });

    expect(result).toEqual({
      totalCents: 30_000,
      lineItems: [
        expect.objectContaining({ kind: 'plan_base', billedDays: 31, periodDays: 31, amountCents: 30_000 }),
      ],
    });
  });

  it.each([
    [0, 0],
    [999, 0],
    [1000, 0], // exactly at the included amount is free
    [1001, 50],
    [1002, 100],
    [1100, 5_000],
    [2000, 50_000],
  ])('%i files -> $%i overage cents', (files, overageCents) => {
    const result = statement('premium', { filesThisPeriod: files });

    expect(result.totalCents).toBe(30_000 + overageCents);
    const overage = result.lineItems.find((line) => line.kind === 'overage');
    if (overageCents === 0) expect(overage).toBeUndefined();
    else expect(overage).toMatchObject({ files: files - 1000, unitCents: 50, amountCents: overageCents });
  });

  it('does not bill employee seats — the base covers them', () => {
    const result = statement('premium', { seatIntervals: [seat('u1', '2026-01-01', null)] });

    expect(result.lineItems.map((line) => line.kind)).toEqual(['plan_base']);
  });
});

describe('closing a period early (`upTo`) — how a plan change prorates the outgoing plan', () => {
  const switchDay = '2026-03-11'; // 10 of 31 days elapsed

  it('prorates the Premium base by elapsed days over the FULL period', () => {
    // 30000 * 10 / 31 = 9677.4 -> 9677
    const result = statement('premium', { upTo: d(switchDay) });

    expect(result.lineItems[0]).toMatchObject({ billedDays: 10, periodDays: 31, amountCents: 9_677 });
  });

  it('still bills Premium overage on the files uploaded so far', () => {
    const result = statement('premium', { upTo: d(switchDay), filesThisPeriod: 1_010 });

    expect(result.totalCents).toBe(9_677 + 10 * 50);
  });

  it('clips Basic seat time to the elapsed days', () => {
    // Active since before the period; only Mar 1..10 (10 days) elapsed.
    const result = statement('basic', {
      upTo: d(switchDay),
      seatIntervals: [seat('u1', '2026-01-01', null)],
    });

    expect(result.lineItems[0]).toMatchObject({ activeDays: 10, amountCents: 161 });
  });

  it('an employee who joined after the switch day is not billed on the closing invoice', () => {
    const result = statement('basic', {
      upTo: d(switchDay),
      seatIntervals: [seat('u1', '2026-03-15', null)],
    });

    expect(result.lineItems).toEqual([]);
  });

  it('reads the switch as a day, not an instant', () => {
    const morning = statement('premium', { upTo: d('2026-03-11T00:00:01Z') });
    const evening = statement('premium', { upTo: d('2026-03-11T23:59:59Z') });

    expect(morning.totalCents).toBe(evening.totalCents);
  });

  it('bills nothing when the switch is on the first day of the period', () => {
    expect(statement('premium', { upTo: d('2026-03-01') })).toEqual({ lineItems: [], totalCents: 0 });
    expect(statement('premium', { upTo: d('2026-02-15') })).toEqual({ lineItems: [], totalCents: 0 });
  });

  it('an `upTo` past the end changes nothing', () => {
    expect(statement('premium', { upTo: d('2027-01-01') })).toEqual(statement('premium'));
  });

  it('free stays free', () => {
    expect(statement('free', { upTo: d(switchDay) }).totalCents).toBe(0);
  });
});

/**
 * Every up/downgrade pair. The customer leaves `from`, so THE OUTGOING plan
 * is what the closing invoice bills; the incoming plan starts a fresh period
 * with no proration charge (D6). Same fixture for all six: a 31-day period, a
 * switch on Mar 11, two employees (one active all period, one who joined Mar 6),
 * and 1,020 files.
 */
describe('proration on every plan change', () => {
  const employees = [seat('u1', '2026-01-01', null), seat('u2', '2026-03-06', null)];
  const closing = (from: Plan) =>
    statement(from, { upTo: d('2026-03-11'), seatIntervals: employees, filesThisPeriod: 1_020 });

  // u1: Mar 1..10 = 10 days -> 161.  u2: Mar 6..10 = 5 days -> 80.6 -> 81.
  const BASIC_CLOSING = 161 + 81;
  // 30000 * 10/31 = 9677 base, + 20 files over -> 1000.
  const PREMIUM_CLOSING = 9_677 + 20 * 50;

  it.each([
    ['free -> basic', 'free', 0],
    ['free -> premium', 'free', 0],
    ['basic -> free', 'basic', BASIC_CLOSING],
    ['basic -> premium', 'basic', BASIC_CLOSING],
    ['premium -> free', 'premium', PREMIUM_CLOSING],
    ['premium -> basic', 'premium', PREMIUM_CLOSING],
  ] as const)('%s: the closing invoice is the OUTGOING plan, prorated', (_pair, from, expected) => {
    expect(closing(from).totalCents).toBe(expected);
  });
});

describe('rounding properties', () => {
  it.each([28, 29, 30, 31])('in a %i-day period a seat charge is monotonic, bounded and exact at the ends', (length) => {
    const period: Period = {
      start: d('2026-03-01'),
      end: new Date(d('2026-03-01').getTime() + length * 86_400_000),
    };

    let previous = 0;
    for (let days = 1; days <= length; days += 1) {
      const from = new Date(period.end.getTime() - days * 86_400_000);
      const result = computeLineItems({
        plan: 'basic',
        period,
        seatIntervals: [{ userId: 'u', from, to: null }],
        filesThisPeriod: 0,
      });

      expect(result.totalCents).toBeGreaterThanOrEqual(previous);
      expect(result.totalCents).toBeLessThanOrEqual(500);
      previous = result.totalCents;
    }
    expect(previous).toBe(500);
  });

  it('splitting one stay into two adjacent intervals never changes the bill by more than a cent', () => {
    // The disable-then-reactivate case: rounding each half separately must not
    // drift materially from billing the whole stay at once.
    const whole = statement('basic', { seatIntervals: [seat('u', '2026-03-01', null)] }).totalCents;

    for (let day = 2; day <= 31; day += 1) {
      const split = new Date(d('2026-03-01').getTime() + (day - 1) * 86_400_000);
      const result = statement('basic', {
        seatIntervals: [
          { userId: 'u', from: d('2026-03-01'), to: split },
          { userId: 'u', from: split, to: null },
        ],
      });

      expect(Math.abs(result.totalCents - whole)).toBeLessThanOrEqual(1);
    }
  });

  it('every total is the sum of its lines, all integers', () => {
    const result = statement('basic', {
      seatIntervals: [seat('a', '2026-03-03', null), seat('b', '2026-03-09', '2026-03-27'), seat('c', '2026-03-21', null)],
    });

    expect(result.totalCents).toBe(result.lineItems.reduce((sum, line) => sum + line.amountCents, 0));
    for (const line of result.lineItems) expect(Number.isInteger(line.amountCents)).toBe(true);
  });
});
