"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUES } from "@/components/marketing/hues";
import { cn } from "@/lib/cn";
import { cssVars } from "@/lib/css-vars";
import { isActive, navFor, type Role } from "./nav";

/**
 * The application's navigation: grouped like the tabs of a binder, each entry carrying its division's hue as a tab edge
 * when it is the open page. Used in the desktop rail and, unchanged, in the phone drawer (`onNavigate` closes it).
 */
export function NavList({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // Resolved here, in the browser bundle: a nav entry holds an icon component, which cannot cross from a server component.
  const groups = navFor(role);
  return (
    <nav aria-label="Application" className="flex flex-col gap-5">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-2.5 pb-1 text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isActive(item, pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                style={cssVars({ "--tab": `var(${HUES[item.hue].cssVar})` })}
                className={cn(
                  "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-base text-text-muted transition-colors duration-(--duration-fast) hover:bg-sunken hover:text-text",
                  active && "bg-sunken font-semibold text-text",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-(--tab) transition-transform duration-(--duration-base) ease-(--ease-out)",
                    active ? "scale-y-100" : "scale-y-0",
                  )}
                />
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
