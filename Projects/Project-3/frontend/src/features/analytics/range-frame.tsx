"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";
import { cn } from "@/lib/cn";
import { RANGES, type RangeId } from "./range";

/**
 * The one row of controls above the charts: the date range every figure below is cut to. Choosing one asks the page for
 * the new numbers and, while they load, the old charts stay where they are, dimmed: no skeleton and no jump, so the
 * frame holds still and only the data changes.
 */
export function RangeFrame({
  selected,
  children,
}: {
  selected: RangeId;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex w-fit max-w-full overflow-x-auto rounded-md border border-line-strong bg-surface p-0.5">
        <legend className="sr-only">Date range</legend>
        {RANGES.map((range) => {
          const on = range.id === selected;
          return (
            <button
              key={range.id}
              type="button"
              aria-pressed={on}
              className={cn(
                "shrink-0 rounded-sm px-3.5 py-1.5 text-sm font-semibold transition-colors duration-(--duration-fast)",
                on
                  ? "bg-tag text-on-tag"
                  : "text-text-muted hover:bg-sunken hover:text-text",
              )}
              onClick={() => {
                if (on) return;
                startTransition(() => {
                  router.replace(
                    range.id === "period"
                      ? pathname
                      : `${pathname}?range=${range.id}`,
                    { scroll: false },
                  );
                });
              }}
            >
              {range.label}
            </button>
          );
        })}
      </fieldset>
      <div
        aria-busy={pending}
        className={cn(
          "flex flex-col gap-6 transition-opacity duration-(--duration-fast)",
          pending && "opacity-60",
        )}
      >
        {children}
      </div>
    </div>
  );
}
