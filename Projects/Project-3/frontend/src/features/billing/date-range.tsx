import { formatDay, lastDayOf } from "@/lib/format/time";

/**
 * A billing period as one run of text: "Sep 23, 2026 – Oct 22, 2026". It is set in the page's own face with tabular
 * figures, not in the mono face used for money, so the dates and the dash sit at one weight and one width. `endExclusive`
 * is how the API sends a period's end (the day the next one starts), so the last day shown is the day before.
 */
export function DateRange({
  start,
  endExclusive,
  className,
}: {
  start: string;
  endExclusive: string;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="num">{formatDay(start)}</span>
      <span aria-hidden> – </span>
      <span className="sr-only"> to </span>
      <span className="num">{lastDayOf(endExclusive)}</span>
    </span>
  );
}
