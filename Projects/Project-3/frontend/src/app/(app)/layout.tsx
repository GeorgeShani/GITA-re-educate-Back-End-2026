import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ActivatingPlan } from "@/components/app/activating-plan";
import { AppShell } from "@/components/app/app-shell";
import { Busy } from "@/components/app/busy";
import { PLAN_LABEL } from "@/components/marketing/pricing/plan-copy";
import { apiClient } from "@/lib/session/api";
import { PATH_HEADER } from "@/lib/session/config";
import { apiIsAvailable, requireSession } from "@/lib/session/session";
import { getSubscription } from "@/lib/session/subscription";

/**
 * The Application layout: the company dashboard. It is where the session is demanded (a page of this group never renders
 * for someone the API does not recognise), and where a company with no plan yet is sent to choose one, because every
 * feature past that point answers "choose a plan first".
 *
 * It is read once per visit to the group, not on every click between its pages: the plan meter and the inbox count in
 * the frame are as fresh as the last full load, until the live connection updates them.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  // Busy or restarting is not signed out: say so, keep the session, and try again by itself.
  if (!(await apiIsAvailable())) return <Busy />;
  const session = await requireSession();
  const api = apiClient(session.accessToken);

  const [subscription, unread] = await Promise.all([
    getSubscription(session.accessToken),
    api.GET("/notifications/unread-count"),
  ]);
  const path = (await headers()).get(PATH_HEADER) ?? "";
  if (subscription.response.status === 404) {
    // Back from paying at Stripe, before its confirmation has reached the API: the plan is about to exist, so wait for it
    // rather than showing the plan picker again (which would invite a second payment).
    if (path.includes("checkout=success")) return <ActivatingPlan />;
    redirect(
      path.includes("checkout=cancelled")
        ? "/welcome?checkout=cancelled"
        : "/welcome",
    );
  }

  // A suspended company reaches almost nothing: its admin gets the billing page (the one place that lets them pay), and
  // everyone else a plain statement of why nothing opens.
  const suspended = session.company.status === "suspended";
  if (
    suspended &&
    session.user.role === "admin" &&
    !path.startsWith("/billing")
  ) {
    redirect("/billing");
  }

  const plan = subscription.data
    ? {
        name: PLAN_LABEL[subscription.data.plan],
        filesUsed: subscription.data.usage.files,
        filesLimit: subscription.data.limits.filesPerPeriod,
      }
    : null;

  return (
    <AppShell
      user={{
        fullName: session.user.fullName,
        email: session.user.email,
        role: session.user.role,
      }}
      company={{
        name: session.company.name,
        isDemo: session.company.isDemo,
        suspended,
      }}
      plan={plan}
      unread={unread.data?.count ?? 0}
    >
      {suspended && session.user.role !== "admin" ? (
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-16">
          <h1 className="headline text-4xl leading-[0.98]">
            Your company is suspended
          </h1>
          <p className="text-text-muted">
            An invoice is overdue, so files and reports are closed to everyone
            until it is paid. Ask your admin to open Billing and pay it. Nothing
            has been deleted.
          </p>
        </div>
      ) : (
        children
      )}
    </AppShell>
  );
}
