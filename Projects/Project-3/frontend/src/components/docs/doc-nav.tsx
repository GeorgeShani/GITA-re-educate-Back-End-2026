"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { DOC_SECTIONS, hrefOf } from "@/lib/docs/registry";

/** The table of contents of the manual: every guide, grouped, with the open one marked. */
export function DocNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  return (
    <nav aria-label="Documentation" className="flex flex-col gap-6">
      {DOC_SECTIONS.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase">
            {section.title}
          </p>
          {section.pages.map((page) => {
            const href = hrefOf(page);
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-8 items-center rounded-md px-2.5 py-1 text-base text-text-muted transition-colors duration-(--duration-fast) hover:bg-sunken hover:text-text",
                  active && "bg-sunken font-semibold text-text",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-tab-grass transition-transform duration-(--duration-base) ease-(--ease-out)",
                    active ? "scale-y-100" : "scale-y-0",
                  )}
                />
                {page.title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
