import {
  Bell,
  BookOpen,
  ChartColumn,
  CreditCard,
  FileSpreadsheet,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
  ScrollText,
  Settings,
  Users,
  Webhook,
} from "lucide-react";
import type { Hue } from "@/components/marketing/hues";

export type Role = "admin" | "employee";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** The division's hue: the colour of the tab edge when this is the open page. */
  hue: Hue;
  /** Who sees it. Absent: everyone signed in. The API still decides what each person may DO there. */
  roles?: readonly Role[];
  /** Other paths that belong to this entry (a settings sub-page keeps "Settings" lit). */
  also?: readonly string[];
  /** Opens a different part of the site, so it is not a "page you are on". */
  external?: boolean;
}

export interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Work",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        hue: "ink",
      },
      { href: "/files", label: "Files", icon: FileSpreadsheet, hue: "orange" },
      {
        href: "/quality-rules",
        label: "Quality rules",
        icon: ListChecks,
        hue: "grass",
      },
      {
        href: "/notifications",
        label: "Notifications",
        icon: Bell,
        hue: "blue",
      },
    ],
  },
  {
    label: "Company",
    items: [
      {
        href: "/employees",
        label: "People",
        icon: Users,
        hue: "teal",
        roles: ["admin"],
      },
      {
        href: "/billing",
        label: "Billing",
        icon: CreditCard,
        hue: "blue",
        roles: ["admin"],
      },
      {
        href: "/analytics",
        label: "Analytics",
        icon: ChartColumn,
        hue: "sienna",
        roles: ["admin"],
      },
      {
        href: "/audit",
        label: "Audit log",
        icon: ScrollText,
        hue: "ink",
        roles: ["admin"],
      },
    ],
  },
  {
    label: "Developers",
    items: [
      {
        href: "/developers/api-keys",
        label: "API keys",
        icon: KeyRound,
        hue: "teal",
      },
      {
        href: "/developers/webhooks",
        label: "Webhooks",
        icon: Webhook,
        hue: "orange",
        roles: ["admin"],
      },
      {
        href: "/docs",
        label: "Documentation",
        icon: BookOpen,
        hue: "grass",
        external: true,
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        href: "/settings/profile",
        label: "Settings",
        icon: Settings,
        hue: "ink",
        also: ["/settings"],
      },
    ],
  },
];

/** The groups this person may see, with empty ones dropped. */
export function navFor(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || item.roles.includes(role),
    ),
  })).filter((group) => group.items.length > 0);
}

export function isActive(item: NavItem, pathname: string): boolean {
  if (item.external) return false;
  const roots = [item.href, ...(item.also ?? [])];
  return roots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

/** The name of the section a path is in, for the top bar. */
export function sectionLabel(pathname: string): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isActive(item, pathname)) return item.label;
    }
  }
  return "Gridline";
}
