"use client";

import {
  Bell,
  ChartColumn,
  Code,
  CreditCard,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mark } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

// Role-aware filtering (admin-only entries) arrives with the session work.
const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/files", label: "Files", icon: FileSpreadsheet },
  { href: "/quality-rules", label: "Quality rules", icon: ListChecks },
  { href: "/employees", label: "People", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/analytics", label: "Analytics", icon: ChartColumn },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/developers/api-keys", label: "Developers", icon: Code },
  { href: "/settings/profile", label: "Settings", icon: Settings },
] as const;

export function RailNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Application"
      className="sticky top-0 flex h-dvh w-56 shrink-0 flex-col gap-1 border-r border-line bg-surface p-3"
    >
      <Link
        href="/dashboard"
        aria-label="Gridline dashboard"
        className="mb-3 px-2 py-2"
      >
        <Mark />
      </Link>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const section = href.split("/")[1];
        const active = pathname === href || pathname.startsWith(`/${section}`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-base text-text-muted hover:bg-sunken hover:text-text",
              active && "bg-sunken font-semibold text-text",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
