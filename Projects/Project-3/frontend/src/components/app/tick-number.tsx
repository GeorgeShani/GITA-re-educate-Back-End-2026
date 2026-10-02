"use client";

import { formatBytes } from "@/lib/format/bytes";
import { formatCents } from "@/lib/format/money";
import { useInView, useTick } from "@/lib/motion";

type Kind = "count" | "cents" | "bytes";

function show(kind: Kind, value: number): string {
  if (kind === "cents") return formatCents(value);
  if (kind === "bytes") return formatBytes(value);
  return value.toLocaleString("en-US");
}

/** "8.2 KB" into the number and its unit, so the unit can be set smaller than the figure it belongs to. */
function split(text: string): { figure: string; unit: string } {
  const space = text.lastIndexOf(" ");
  return space === -1
    ? { figure: text, unit: "" }
    : { figure: text.slice(0, space), unit: text.slice(space + 1) };
}

/**
 * A figure that counts up to its value the first time it scrolls into view. The element always carries the real value for
 * assistive technology, so the count is decoration only; reduced motion shows the value at once. It never wraps, and a
 * unit (KB, MB) is set at half the figure's size, so a long value stays inside whatever it is placed in.
 */
export function TickNumber({
  value,
  kind = "count",
  className,
}: {
  value: number;
  kind?: Kind;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const shown = useTick(0, value, inView);
  const { figure, unit } = split(show(kind, shown));
  return (
    <span ref={ref} className={className}>
      <span aria-hidden className="num whitespace-nowrap font-mono">
        {figure}
        {unit ? (
          <span className="ml-1 font-sans text-[0.5em] font-semibold tracking-normal text-text-muted">
            {unit}
          </span>
        ) : null}
      </span>
      <span className="sr-only">{show(kind, value)}</span>
    </span>
  );
}
