"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface Item {
  href: string;
  label: string;
}

/**
 * The sections of Settings, as a row of tabs on a phone and a column beside the page on a wide screen. The open one is
 * marked with `aria-current`, not colour alone.
 */
export function SettingsNav({ items }: { items: readonly Item[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Settings sections"
      className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0 lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible"
    >
      {items.map((item) => {
        const on = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md border px-3 py-2 font-semibold transition-colors duration-(--duration-fast)",
              on
                ? "border-line-strong bg-sunken text-text"
                : "border-transparent text-text-muted hover:bg-sunken hover:text-text",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
