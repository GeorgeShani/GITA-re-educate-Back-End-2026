import type { components } from "@/lib/api/schema";
import { daysBetween } from "./scale";

type Quota = components["schemas"]["QuotaBurnDownDto"];

export interface BurnRow {
  date: string;
  /** Cumulative files so far; absent for days that have not happened yet, so the line stops at today. */
  used: number | undefined;
  pace: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** One row per day of the whole period: what was used (until today) and where an even pace would be (all the way). */
export function burnRows(quota: Quota): BurnRow[] {
  const days = Math.max(1, daysBetween(quota.periodStart, quota.periodEnd));
  const known = new Map(quota.points.map((point) => [point.date, point]));
  const start = new Date(`${quota.periodStart.slice(0, 10)}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    const point = known.get(date);
    return {
      date,
      used: point?.used,
      pace: round1(point?.pace ?? (quota.limit * (index + 1)) / days),
    };
  });
}
