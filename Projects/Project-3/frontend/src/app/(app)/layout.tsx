import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { PLAN_LABEL } from "@/components/marketing/pricing/plan-copy";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

/**
 * The Application layout: the company dashboard. It is where the session is demanded (a page of this group never renders
 * for someone the API does not recognise), and where a company with no plan yet is sent to choose one, because every
 * feature past that point answers "choose a plan first".
 *
 * It is read once per visit to the group, not on every click between its pages: the plan meter and the inbox count in
 * the frame are as fresh as the last full load, until the live connection updates them.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const api = apiClient(session.accessToken);

  const [subscription, unread] = await Promise.all([
    api.GET("/subscriptions/me"),
    api.GET("/notifications/unread-count"),
  ]);
  if (subscription.response.status === 404) redirect("/welcome");

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
        suspended: session.company.status === "suspended",
      }}
      plan={plan}
      unread={unread.data?.count ?? 0}
    >
      {children}
    </AppShell>
  );
}
