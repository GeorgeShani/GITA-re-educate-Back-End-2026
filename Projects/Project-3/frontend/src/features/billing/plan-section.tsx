"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  limit,
  overageLine,
  PLAN_LABEL,
  priceLine,
} from "@/components/marketing/pricing/plan-copy";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Stamp } from "@/components/ui/stamp";
import { messageFor } from "@/features/files/upload";
import { callApi, succeeded } from "@/lib/api/call";
import type { Plan } from "@/lib/api/plans";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/format/money";
import { isRecord } from "@/lib/guards";

type PlanName = Plan["plan"];

interface Usage {
  files: number;
  employees: number;
}

/** What a month on this plan costs at the team's present size, before any proration or file overage. */
function estimateCents(plan: Plan, employees: number): number {
  return plan.basePriceCents + plan.seatPriceCents * employees;
}

/** Why the API would refuse this change, when the numbers already say so. The API still has the last word. */
function blocker(target: Plan, usage: Usage): string | null {
  if (target.maxEmployees !== null && usage.employees > target.maxEmployees) {
    return `${PLAN_LABEL[target.plan]} allows ${target.maxEmployees} ${target.maxEmployees === 1 ? "employee" : "employees"} and you have ${usage.employees}. Remove ${usage.employees - target.maxEmployees} first.`;
  }
  if (
    target.overagePerFileCents === null &&
    usage.files > target.filesPerPeriod
  ) {
    return `You have uploaded ${usage.files.toLocaleString("en-US")} files this period and ${PLAN_LABEL[target.plan]} allows ${target.filesPerPeriod.toLocaleString("en-US")}. It becomes possible when the period rolls over.`;
  }
  return null;
}

/** The checkout address in a 202 answer, when there is one. */
function checkoutUrl(body: unknown): string | null {
  if (!isRecord(body)) return null;
  const { checkoutUrl: url } = body;
  return typeof url === "string" ? url : null;
}

/**
 * The three plans side by side, with the one the company is on marked, and a confirmation that says what changes before
 * anything does. Paid plans may go through Stripe Checkout; the answer is then a redirect, not an instant switch.
 */
export function PlanSection({
  plans,
  current,
  usage,
}: {
  plans: Plan[];
  current: PlanName;
  usage: Usage;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const from = plans.find((plan) => plan.plan === current);
  const reason = target ? blocker(target, usage) : null;

  const confirm = async (plan: Plan) => {
    setBusy(true);
    setProblem(null);
    const result = await callApi(
      "PATCH",
      "/subscriptions/me",
      { plan: plan.plan },
      { "Idempotency-Key": crypto.randomUUID() },
    );
    if (result.status === 202) {
      const url = checkoutUrl(result.body);
      if (url) {
        window.location.assign(url);
        return;
      }
      setDone(
        `The change to ${PLAN_LABEL[plan.plan]} is being applied. It shows here in a moment.`,
      );
      setTarget(null);
      router.refresh();
    } else if (succeeded(result)) {
      const charged =
        isRecord(result.body) && typeof result.body.prorationCents === "number"
          ? result.body.prorationCents
          : 0;
      setDone(
        charged > 0
          ? `You are on ${PLAN_LABEL[plan.plan]}. The part of the period on your old plan came to ${formatCents(charged)}.`
          : `You are on ${PLAN_LABEL[plan.plan]}.`,
      );
      setTarget(null);
      router.refresh();
    } else {
      setProblem(messageFor(result));
    }
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {done ? (
        <output className="block rounded-md border border-pass bg-pass-soft p-3 font-medium text-pass">
          {done}
        </output>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const mine = plan.plan === current;
          return (
            <section
              key={plan.plan}
              aria-label={`${PLAN_LABEL[plan.plan]} plan`}
              className={cn(
                "leaf flex flex-col gap-4 p-5",
                mine && "border-text",
              )}
            >
              <div className="flex min-h-[4.75rem] items-start justify-between gap-3">
                <div>
                  <h3 className="headline text-3xl leading-none">
                    {PLAN_LABEL[plan.plan]}
                  </h3>
                  <p className="num mt-2 font-mono text-sm font-medium">
                    {priceLine(plan)}
                  </p>
                </div>
                {mine ? <Stamp tone="pass">Your plan</Stamp> : null}
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
                <li>
                  {plan.rateLimitPerMinute.toLocaleString("en-US")} API requests
                  a minute
                </li>
              </ul>
              {mine ? (
                <Button disabled className="w-full">
                  Current plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant={
                    from &&
                    plan.basePriceCents + plan.seatPriceCents >
                      from.basePriceCents + from.seatPriceCents
                      ? "primary"
                      : "secondary"
                  }
                  onClick={() => {
                    setDone(null);
                    setProblem(null);
                    setTarget(plan);
                  }}
                >
                  Switch to {PLAN_LABEL[plan.plan]}
                </Button>
              )}
            </section>
          );
        })}
      </div>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setTarget(null);
        }}
        title={target ? `Switch to ${PLAN_LABEL[target.plan]}?` : "Switch plan"}
        description="What changes, before anything does."
      >
        {target && from ? (
          <div className="flex flex-col gap-4 p-5">
            <dl className="grid grid-cols-[1fr_auto_auto_auto] items-baseline gap-x-3 gap-y-2 text-sm">
              <dt className="text-text-muted" />
              <dd className="font-semibold">{PLAN_LABEL[from.plan]}</dd>
              <dd aria-hidden />
              <dd className="font-semibold">{PLAN_LABEL[target.plan]}</dd>
              <Row
                label="A month at your team size"
                before={formatCents(estimateCents(from, usage.employees))}
                after={formatCents(estimateCents(target, usage.employees))}
              />
              <Row
                label="Files a period"
                before={from.filesPerPeriod.toLocaleString("en-US")}
                after={target.filesPerPeriod.toLocaleString("en-US")}
              />
              <Row
                label="Employees"
                before={limit(from.maxEmployees)}
                after={limit(target.maxEmployees)}
              />
              <Row
                label="Requests a minute"
                before={from.rateLimitPerMinute.toLocaleString("en-US")}
                after={target.rateLimitPerMinute.toLocaleString("en-US")}
              />
            </dl>
            <p className="text-sm text-text-muted">
              The estimate is before proration for the days already used, and
              before any file past the quota. Your next invoice shows the exact
              figures.
            </p>
            {reason ? (
              <p
                role="note"
                className="rounded-md border border-caution bg-caution-soft p-3 text-caution"
              >
                {reason}
              </p>
            ) : null}
            {problem ? (
              <p role="alert" className="font-medium text-hold">
                {problem}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button disabled={busy} onClick={() => setTarget(null)}>
                Keep {PLAN_LABEL[from.plan]}
              </Button>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void confirm(target)}
              >
                {busy ? (
                  <LoaderCircle aria-hidden className="animate-spin" />
                ) : (
                  <ArrowRight aria-hidden />
                )}
                Switch to {PLAN_LABEL[target.plan]}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function Row({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <>
      <dt className="text-text-muted">{label}</dt>
      <dd className="num text-right font-mono">{before}</dd>
      <dd aria-hidden className="text-text-subtle">
        →
      </dd>
      <dd className="num text-right font-mono font-semibold">{after}</dd>
    </>
  );
}
