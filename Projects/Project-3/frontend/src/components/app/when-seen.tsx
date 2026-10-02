"use client";

import type { ReactNode } from "react";
import { useInView } from "@/lib/motion";

/**
 * Holds its place at a fixed height and draws its children the first time it scrolls into view, so a chart plays its
 * "draw from zero" entrance where the reader can see it instead of before they arrive. The space is reserved, so nothing
 * shifts when it appears.
 */
export function WhenSeen({
  height,
  children,
}: {
  height: number;
  children: ReactNode;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div ref={ref} style={{ height }} className="w-full">
      {inView ? children : null}
    </div>
  );
}
