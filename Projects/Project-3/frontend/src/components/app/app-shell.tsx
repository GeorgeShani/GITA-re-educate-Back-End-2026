import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/cn";
import { LiveBell } from "./live-bell";
import { MobileNav } from "./mobile-nav";
import type { Role } from "./nav";
import { SectionName } from "./page-title";
import { PlanMeter, type PlanSummary } from "./plan-meter";
import { NavList } from "./rail-nav";
import { UserMenu } from "./user-menu";

export interface ShellProps {
  user: { fullName: string; email: string; role: Role };
  company: { name: string; isDemo: boolean; suspended: boolean };
  plan: PlanSummary | null;
  unread: number;
  children: ReactNode;
}

/**
 * The signed-in application's frame, shared by every page of the company dashboard: a rail of divisions on the left
 * (a drawer on a phone), a top bar with the section, the inbox and the person, and the page itself. Page content owns
 * its own width: the shell only gives it the room.
 */
export function AppShell({
  user,
  company,
  plan,
  unread,
  children,
}: ShellProps) {
  return (
    <div className="flex min-h-dvh flex-1">
      {/* The column runs the full height of the page, so its background and rule never stop short on a long page; the rail inside it stays pinned to the window. */}
      <div className="hidden w-60 shrink-0 border-r border-line bg-surface lg:block">
        <aside className="sticky top-0 flex h-dvh flex-col gap-6 overflow-y-auto scrollbar-none p-3">
          <Link
            href="/dashboard"
            aria-label="Gridline dashboard"
            className="rounded-md px-2.5 py-2"
          >
            <Logo />
          </Link>
          <NavList role={user.role} />
          <div className="mt-auto flex flex-col gap-3">
            {plan ? (
              <PlanMeter plan={plan} canManage={user.role === "admin"} />
            ) : null}
          </div>
        </aside>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <Banners company={company} role={user.role} />
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-canvas px-3 sm:px-5">
          <MobileNav role={user.role} companyName={company.name} />
          <div className="flex min-w-0 flex-1 flex-col leading-tight">
            <SectionName />
            <span className="truncate text-sm text-text-muted">
              {company.name}
            </span>
          </div>
          <LiveBell initial={unread} />
          <ThemeToggle />
          <UserMenu
            fullName={user.fullName}
            email={user.email}
            role={user.role}
          />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Things everyone on the page needs to know before they do anything else. */
function Banners({
  company,
  role,
}: {
  company: ShellProps["company"];
  role: Role;
}) {
  if (!company.isDemo && !company.suspended) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2 text-sm font-medium sm:px-5",
        company.suspended
          ? "border-hold bg-hold-soft text-hold"
          : "border-live-ink bg-live text-on-tag",
      )}
    >
      {company.suspended ? (
        <>
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          <span>
            This company is suspended because of an overdue payment.{" "}
            {role === "admin"
              ? "Pay the open invoice to restore access."
              : "Ask your admin to pay the open invoice."}
          </span>
          {role === "admin" ? (
            <Link
              href="/billing"
              className="font-semibold underline underline-offset-2 hover:decoration-2"
            >
              Open billing
            </Link>
          ) : null}
        </>
      ) : (
        <>
          <span>
            You are in the read-only demo. Look around: nothing you do here is
            saved.
          </span>
          <Link
            href="/register"
            className="font-semibold underline underline-offset-2 hover:decoration-2"
          >
            Create your own company
          </Link>
        </>
      )}
    </div>
  );
}
