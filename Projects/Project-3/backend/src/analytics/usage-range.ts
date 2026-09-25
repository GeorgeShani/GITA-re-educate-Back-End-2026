import { BadRequestException } from '@nestjs/common';
import { DAY_MS, type Period, startOfUtcDay } from '#/billing/period.js';

/** A stretch of UTC days, `[from, to)`, both at midnight. */
export interface DayRange {
  from: Date;
  to: Date;
  days: number;
}

/** A year is more than any dashboard chart needs, and bounds the work a request can ask for. */
export const MAX_RANGE_DAYS = 366;

/**
 * The window an analytics request asks about. Both ends are read as UTC DAYS (a time of
 * day is dropped) and `to` is exclusive, like every period in this app. With neither,
 * it is the current billing period so far — its first day through today.
 */
export function resolveRange(
  requested: { from?: Date | undefined; to?: Date | undefined },
  period: Period,
  now: Date,
): DayRange {
  const tomorrow = new Date(startOfUtcDay(now).getTime() + DAY_MS);

  const from = requested.from ? startOfUtcDay(requested.from) : period.start;
  // Default `to`: through today, but not past the end of the period being looked at.
  const to = requested.to
    ? startOfUtcDay(requested.to)
    : new Date(Math.min(tomorrow.getTime(), Math.max(period.end.getTime(), from.getTime() + DAY_MS)));

  if (to.getTime() <= from.getTime()) {
    throw new BadRequestException('`to` must be a later day than `from`.');
  }
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  if (days > MAX_RANGE_DAYS) {
    throw new BadRequestException(`The range is ${days} days; the most that can be asked for is ${MAX_RANGE_DAYS}.`);
  }
  return { from, to, days };
}

/** `2026-03-05` for each UTC day in the range, so a chart gets a point for days with no activity too. */
export function eachDay(range: DayRange): string[] {
  return Array.from({ length: range.days }, (_, index) =>
    new Date(range.from.getTime() + index * DAY_MS).toISOString().slice(0, 10),
  );
}
