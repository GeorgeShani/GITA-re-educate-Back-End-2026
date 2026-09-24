import { PLAN_CATALOG, type Plan } from '#/subscriptions/plan-catalog.js';
import { DAY_MS, type Period, daysIn, startOfUtcDay } from './period.js';

/**
 * The billing engine: pure functions over plain data. No Nest, no database, no
 * clock — every input arrives as an argument, which is what lets the most
 * heavily tested file in the repo test exact dates and exact cents.
 *
 * Money is integer cents. Every prorated amount is `unit × days ÷ periodDays`
 * rounded half-up in INTEGER arithmetic (`divRound`), never through floats.
 */

/**
 * One stretch of billable seat time for an employee. Half-open: `from`
 * inclusive, `to` exclusive, both read as UTC days. `to: null` = still active.
 * Only `active` time appears here — an invited user holds a seat but bills $0
 * until they accept (D4), so they simply have no interval yet.
 */
export interface SeatInterval {
  userId: string;
  from: Date;
  to: Date | null;
}

export type LineItem =
  | {
      kind: 'seat';
      description: string;
      userId: string;
      activeDays: number;
      periodDays: number;
      unitCents: number;
      amountCents: number;
    }
  | {
      kind: 'plan_base';
      description: string;
      billedDays: number;
      periodDays: number;
      unitCents: number;
      amountCents: number;
    }
  | {
      kind: 'overage';
      description: string;
      files: number;
      unitCents: number;
      amountCents: number;
    };

export interface StatementInput {
  plan: Plan;
  period: Period;
  /** Employees only — the admin's seat is not billed. */
  seatIntervals: SeatInterval[];
  filesThisPeriod: number;
  /**
   * Bill only `[period.start, upTo)`. Set when a plan change closes the period
   * early; the denominator stays the FULL period's days, which is what makes
   * the charge a fraction of the price.
   */
  upTo?: Date;
}

export interface Statement {
  lineItems: LineItem[];
  totalCents: number;
}

/** `round-half-up(numerator / denominator)` for non-negative integers, exactly. */
export function divRound(numerator: number, denominator: number): number {
  return Math.floor((2 * numerator + denominator) / (2 * denominator));
}

function prorate(unitCents: number, days: number, periodDays: number): number {
  return days === periodDays ? unitCents : divRound(unitCents * days, periodDays);
}

/** Whole UTC days two half-open ranges share. */
function overlapDays(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const start = Math.max(aStart, bStart);
  const end = Math.min(aEnd, bEnd);
  return end > start ? Math.round((end - start) / DAY_MS) : 0;
}

export function computeLineItems(input: StatementInput): Statement {
  const { plan, period, seatIntervals, filesThisPeriod, upTo } = input;
  const rules = PLAN_CATALOG[plan];
  const periodDays = daysIn(period);

  const windowStart = period.start.getTime();
  const windowEnd = Math.min(
    period.end.getTime(),
    upTo ? startOfUtcDay(upTo).getTime() : period.end.getTime(),
  );
  const windowDays = windowEnd > windowStart ? Math.round((windowEnd - windowStart) / DAY_MS) : 0;

  const lineItems: LineItem[] = [];

  if (rules.seatPriceCents > 0) {
    for (const interval of seatIntervals) {
      const activeDays = overlapDays(
        startOfUtcDay(interval.from).getTime(),
        interval.to ? startOfUtcDay(interval.to).getTime() : Number.POSITIVE_INFINITY,
        windowStart,
        windowEnd,
      );
      // An interval that never touches the window is not a line item at all.
      if (activeDays === 0) continue;

      lineItems.push({
        kind: 'seat',
        description: 'Employee seat',
        userId: interval.userId,
        activeDays,
        periodDays,
        unitCents: rules.seatPriceCents,
        amountCents: prorate(rules.seatPriceCents, activeDays, periodDays),
      });
    }
  }

  if (rules.basePriceCents > 0 && windowDays > 0) {
    lineItems.push({
      kind: 'plan_base',
      description: 'Premium plan',
      billedDays: windowDays,
      periodDays,
      unitCents: rules.basePriceCents,
      amountCents: prorate(rules.basePriceCents, windowDays, periodDays),
    });
  }

  if (rules.overagePerFileCents !== null) {
    const files = Math.max(0, filesThisPeriod - rules.filesPerPeriod);
    if (files > 0) {
      lineItems.push({
        kind: 'overage',
        description: `Files over the ${rules.filesPerPeriod} included`,
        files,
        unitCents: rules.overagePerFileCents,
        amountCents: files * rules.overagePerFileCents,
      });
    }
  }

  const totalCents = lineItems.reduce((sum, line) => sum + line.amountCents, 0);
  return { lineItems, totalCents };
}
