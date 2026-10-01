"use client";

import { usePathname } from "next/navigation";
import { sectionLabel } from "./nav";

/** The name of the section the visitor is in, in the top bar. The page itself carries the real `<h1>`. */
export function SectionName() {
  return (
    <span className="truncate text-base font-semibold">
      {sectionLabel(usePathname())}
    </span>
  );
}
