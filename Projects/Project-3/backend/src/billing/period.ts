/**
 * Billing period arithmetic. Pure functions, UTC only, no `Date.now()`.
 *
 * A period is half-open `[start, end)` and both ends sit on a UTC midnight, so
 * every period is a whole number of days and proration is exact integer maths.
 * The period is anchored to a day of the month (the day the subscription was
 * activated, D6) and CLAMPED per month: anchor 31 gives Jan 31, Feb 28 (29 in a
 * leap year), Mar 31, Apr 30 … Each month is clamped independently, so the
 * anchor never drifts to the 28th permanently after one short month.
 */
export interface Period {
  start: Date;
  end: Date;
}

export const DAY_MS = 24 * 60 * 60_000;

export function startOfUtcDay(instant: Date): Date {
  return new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
}

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** The anchor day, clamped into `month` (0-based) of `year`, at UTC midnight. */
function anchorIn(year: number, month: number, anchorDay: number): Date {
  return new Date(Date.UTC(year, month, Math.min(anchorDay, daysInMonth(year, month))));
}

/** The period containing `instant`. `anchorDay` is 1–31. */
export function periodFor(anchorDay: number, instant: Date): Period {
  if (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
    throw new RangeError(`billing anchor day must be 1-31, got ${anchorDay}`);
  }

  const year = instant.getUTCFullYear();
  const month = instant.getUTCMonth();

  // This month's anchor is the start if it has already begun; otherwise the
  // period began at last month's anchor. `Date.UTC` normalises month -1 / 12.
  const thisMonth = anchorIn(year, month, anchorDay);
  const startYearMonth: [number, number] =
    thisMonth.getTime() <= instant.getTime() ? [year, month] : [year, month - 1];

  const start = anchorIn(startYearMonth[0], startYearMonth[1], anchorDay);
  const end = anchorIn(startYearMonth[0], startYearMonth[1] + 1, anchorDay);
  return { start, end };
}

/** The period that begins where `period` ends. */
export function nextPeriod(anchorDay: number, period: Period): Period {
  return periodFor(anchorDay, period.end);
}

/**
 * The period that contains `now`, for a READ that must not write. A subscription's
 * stored period lags reality between it ending and the daily job running; billing
 * screens should show the period we are actually in. While the stored period is
 * still current it is returned as-is, otherwise it is recomputed from the anchor —
 * which is exactly what rolling forward month by month arrives at.
 */
export function effectivePeriod(anchorDay: number, stored: Period, now: Date): Period {
  return now.getTime() < stored.end.getTime() ? stored : periodFor(anchorDay, now);
}

/** Whole days in the period. */
export function daysIn(period: Period): number {
  return Math.round((period.end.getTime() - period.start.getTime()) / DAY_MS);
}

/**
 * Stable label for a period — its start date, `YYYY-MM-DD`. What `UsageEvent`
 * stores so a period's uploads can be counted with an equality lookup.
 */
export function periodKey(period: Period): string {
  return period.start.toISOString().slice(0, 10);
}

/**
 * The first period of a new activation or plan change: it starts at UTC
 * midnight of `instant`'s day (that whole day belongs to the new plan) and the
 * billing anchor becomes that day of the month (D6).
 */
export function openPeriodAt(instant: Date): { period: Period; anchorDay: number } {
  const start = startOfUtcDay(instant);
  const anchorDay = start.getUTCDate();
  return { period: periodFor(anchorDay, start), anchorDay };
}
