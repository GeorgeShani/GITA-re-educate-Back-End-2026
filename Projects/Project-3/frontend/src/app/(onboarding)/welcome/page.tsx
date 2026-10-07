import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PlanPicker } from "@/features/onboarding/plan-picker";
import { fetchPlans } from "@/lib/api/plans";
import { apiClient } from "@/lib/session/api";
import { WANTED_PLAN_COOKIE } from "@/lib/session/config";
import { requireSession } from "@/lib/session/session";

export const metadata = { title: "Choose your plan" };

/**
 * The first thing a new company does: choose a plan. Every feature past this answers "choose a plan first", so the
 * dashboard sends people here until they have. Anyone who already has one is sent on.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await requireSession();
  const { response } = await apiClient(session.accessToken).GET(
    "/subscriptions/me",
  );
  if (response.ok) redirect("/dashboard");

  if (session.user.role !== "admin") {
    return (
      <>
        <h1 className="headline text-4xl leading-[0.98]">Almost ready</h1>
        <p className="copy max-w-xl text-text-muted">
          {session.company.name} has not chosen a plan yet. Ask your admin to
          choose one, and everything here will open up.
        </p>
      </>
    );
  }

  const [plans, { checkout }, jar] = await Promise.all([
    fetchPlans(),
    searchParams,
    cookies(),
  ]);
  const wanted = jar.get(WANTED_PLAN_COOKIE)?.value;
  const suggested = wanted === "basic" || wanted === "premium" ? wanted : null;

  return (
    <>
      <div className="flex flex-col gap-3">
        <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
          Choose how {session.company.name} starts
        </h1>
        <p className="copy max-w-2xl text-text-muted">
          Free needs no card and you can change plan any time. A paid plan takes
          you to our payment provider to confirm it.
        </p>
      </div>
      {checkout === "cancelled" ? (
        <output className="block rounded-md border border-line-strong bg-sunken p-3 text-sm font-medium">
          Checkout was cancelled and you were not charged. Choose a plan when
          you are ready.
        </output>
      ) : null}
      {plans ? (
        <PlanPicker plans={plans} suggested={suggested} />
      ) : (
        <p
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-3 text-sm font-medium text-hold"
        >
          We could not load the plans just now. Reload the page in a moment.
        </p>
      )}
    </>
  );
}
