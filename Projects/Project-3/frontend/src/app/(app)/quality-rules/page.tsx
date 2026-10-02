import { RulesView } from "@/features/quality-rules/rules-view";
import { fetchPlans } from "@/lib/api/plans";
import { apiClient } from "@/lib/session/api";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Quality rules" };

/** Rules past this are not listed here. No plan allows anything near it, so the page says so rather than paging. */
const SHOWN = 100;

export default async function Page() {
  const session = await requireSession();
  const api = apiClient(session.accessToken);
  const [rules, subscription, plans] = await Promise.all([
    api.GET("/quality-rules", { params: { query: { limit: SHOWN } } }),
    api.GET("/subscriptions/me"),
    fetchPlans(),
  ]);

  const plan = subscription.data
    ? plans?.find((entry) => entry.plan === subscription.data.plan)
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Quality rules
        </h1>
        <p className="max-w-prose text-text-muted">
          What good data means for your company. Every upload is checked against
          these rules and scored.
        </p>
      </header>

      {rules.data ? (
        <>
          <RulesView
            rules={rules.data.data}
            canEdit={session.user.role === "admin" && !session.company.isDemo}
            limit={plan?.maxQualityRules ?? null}
            total={rules.data.meta.total}
          />
          {rules.data.meta.total > SHOWN ? (
            <p role="note" className="text-sm text-text-subtle">
              Showing the first {SHOWN} of {rules.data.meta.total} rules.
            </p>
          ) : null}
        </>
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-4 font-medium text-hold"
        >
          We could not load your rules just now. Reload the page in a moment.
        </p>
      )}
    </div>
  );
}
