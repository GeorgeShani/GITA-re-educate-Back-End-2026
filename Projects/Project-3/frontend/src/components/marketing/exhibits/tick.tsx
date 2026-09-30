"use client";

import { useInView, useTick } from "@/lib/motion";

/** A number that counts to its value when it scrolls into view. Tabular figures, so nothing jitters. */
export function Tick({
  from,
  to,
  suffix = "",
  className,
}: {
  from: number;
  to: number;
  suffix?: string;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const value = useTick(from, to, inView);
  return (
    <span ref={ref} className={className}>
      {value.toLocaleString("en-US")}
      {suffix}
    </span>
  );
}
