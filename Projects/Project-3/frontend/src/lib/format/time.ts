const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** "just now", "5 min ago", "3 h ago", "Yesterday", or the date once it is more than a week old. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const ago = now - then;
  if (ago < MINUTE) return "just now";
  if (ago < HOUR) return `${Math.floor(ago / MINUTE)} min ago`;
  if (ago < DAY) return `${Math.floor(ago / HOUR)} h ago`;
  if (ago < 2 * DAY) return "Yesterday";
  if (ago < 7 * DAY) return `${Math.floor(ago / DAY)} days ago`;
  return DATE.format(then);
}

/** The exact moment, for a tooltip: "Oct 2, 2026, 9:14 AM". */
export function exactTime(iso: string): string {
  const then = new Date(iso);
  return Number.isNaN(then.getTime()) ? "" : DATE_TIME.format(then);
}

const DAY_UTC = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** A calendar day as billing sees it (UTC midnights): "Oct 1, 2026". Same on the server and in the browser. */
export function formatDay(iso: string): string {
  const then = new Date(iso);
  return Number.isNaN(then.getTime()) ? "" : DAY_UTC.format(then);
}

/** The last day that is still inside a period whose end is exclusive: "Oct 31, 2026" for an end of Nov 1. */
export function lastDayOf(endExclusiveIso: string): string {
  const end = new Date(endExclusiveIso);
  if (Number.isNaN(end.getTime())) return "";
  return DAY_UTC.format(end.getTime() - DAY);
}

const SHORT_DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "Oct 5" from a `YYYY-MM-DD` day, for a chart's axis and tooltip. */
export function shortDay(day: string): string {
  const then = new Date(`${day.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(then.getTime()) ? day : SHORT_DAY.format(then);
}
