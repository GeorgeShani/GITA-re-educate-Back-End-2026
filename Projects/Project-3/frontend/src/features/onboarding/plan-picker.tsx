"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  limit,
  overageLine,
  PLAN_LABEL,
  priceLine,
} from "@/components/marketing/pricing/plan-copy";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/api/plans";
import { type ChoosePlanState, choosePlan } from "./actions";

const IDLE: ChoosePlanState = { status: "idle" };

function Choose({
  plan,
  recommended,
}: {
  plan: Plan["plan"];
  recommended: boolean;
}) {
  const { pending, data } = useFormStatus();
  const mine = pending && data?.get("plan") === plan;
  return (
    <Button
      type="submit"
      name="plan"
      value={plan}
      variant={recommended ? "primary" : "secondary"}
      size="lg"
      disabled={pending}
      className="w-full"
    >
      {mine
        ? "Setting up…"
        : plan === "free"
          ? "Start free"
          : `Choose ${PLAN_LABEL[plan]}`}
    </Button>
  );
}

/** The three plans, straight from the catalog, each with the one button that chooses it. */
export function PlanPicker({ plans }: { plans: Plan[] }) {
  const [state, action] = useActionState(choosePlan, IDLE);
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-md border border-hold bg-hold-soft p-3 text-sm font-medium text-hold"
        >
          {state.messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <section key={plan.plan} className="leaf flex flex-col gap-4 p-5">
            <div>
              <h2 className="headline text-3xl leading-none">
                {PLAN_LABEL[plan.plan]}
              </h2>
              <p className="num mt-2 font-mono text-sm font-medium">
                {priceLine(plan)}
              </p>
            </div>
            <ul className="flex flex-1 flex-col gap-1.5 text-sm text-text-muted">
              <li>
                <strong className="text-text">
                  {plan.filesPerPeriod.toLocaleString("en-US")}
                </strong>{" "}
                files a period
              </li>
              <li>{overageLine(plan)}</li>
              <li>{limit(plan.maxEmployees)} employees</li>
              <li>{limit(plan.maxQualityRules)} quality rules</li>
            </ul>
            <Choose plan={plan.plan} recommended={plan.plan === "free"} />
          </section>
        ))}
      </div>
    </form>
  );
}
