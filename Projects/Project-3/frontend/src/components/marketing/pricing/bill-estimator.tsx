"use client";

import { useState } from "react";
import { Stamp } from "@/components/ui/stamp";
import type { Plan } from "@/lib/api/plans";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/format/money";
import { PLAN_LABEL } from "./plan-copy";

type Estimate =
  | { kind: "ok"; cents: number; detail: string }
  | { kind: "blocked"; reason: string };

/** One full billing period for a company of this size, on the catalog's own numbers. */
function estimate(plan: Plan, employees: number, files: number): Estimate {
  if (plan.maxEmployees !== null && employees > plan.maxEmployees) {
    return {
      kind: "blocked",
      reason:
        plan.maxEmployees === 0
          ? "No employees on this plan"
          : `Up to ${plan.maxEmployees} employees`,
    };
  }
  const overage = files > plan.filesPerPeriod ? files - plan.filesPerPeriod : 0;
  if (overage > 0 && plan.overagePerFileCents === null) {
    return {
      kind: "blocked",
      reason: `Uploads stop after ${plan.filesPerPeriod.toLocaleString("en-US")} files`,
    };
  }
  const seats = plan.seatPriceCents * employees;
  const extra =
    plan.overagePerFileCents === null ? 0 : plan.overagePerFileCents * overage;
  const parts: string[] = [];
  if (plan.basePriceCents > 0)
    parts.push(`${formatCents(plan.basePriceCents)} base`);
  if (seats > 0)
    parts.push(`${employees} × ${formatCents(plan.seatPriceCents)}`);
  if (extra > 0)
    parts.push(
      `${overage.toLocaleString("en-US")} extra files × ${formatCents(plan.overagePerFileCents ?? 0)}`,
    );
  return {
    kind: "ok",
    cents: plan.basePriceCents + seats + extra,
    detail: parts.join(" + ") || "No charge",
  };
}

/** Two sliders and the bill each plan would produce. It never picks a plan for you: it shows the numbers. */
export function BillEstimator({ plans }: { plans: Plan[] }) {
  const [employees, setEmployees] = useState(6);
  const [files, setFiles] = useState(80);

  const results = plans.map((plan) => ({
    plan,
    estimate: estimate(plan, employees, files),
  }));
  const cheapest = results
    .filter((result) => result.estimate.kind === "ok")
    .reduce<number | null>((best, result) => {
      if (result.estimate.kind !== "ok") return best;
      return best === null || result.estimate.cents < best
        ? result.estimate.cents
        : best;
    }, null);

  return (
    <div className="leaf flex flex-col gap-6 p-6 md:p-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <Slider
          label="Employees"
          value={employees}
          min={0}
          max={60}
          onChange={setEmployees}
        />
        <Slider
          label="Files uploaded in a period"
          value={files}
          min={0}
          max={2500}
          step={10}
          onChange={setFiles}
        />
      </div>

      <ul aria-live="polite" className="flex flex-col">
        {results.map(({ plan, estimate: result }) => (
          <li
            key={plan.plan}
            className="grid grid-cols-[6rem_1fr_auto] items-center gap-x-4 gap-y-1 border-t border-line py-4"
          >
            <span className="headline text-2xl leading-none">
              {PLAN_LABEL[plan.plan]}
            </span>
            {result.kind === "ok" ? (
              <>
                <span className="min-w-0 text-sm text-text-muted">
                  {result.detail}
                  {result.cents === cheapest ? (
                    <Stamp tone="pass" className="ml-2 align-middle">
                      Lowest
                    </Stamp>
                  ) : null}
                </span>
                <span
                  key={result.cents}
                  className="stamp-land num text-right font-mono text-xl font-semibold"
                >
                  {formatCents(result.cents)}
                </span>
              </>
            ) : (
              <>
                <span className="min-w-0 text-sm text-text-muted">
                  {result.reason}
                </span>
                <span className="text-right text-sm text-text-subtle">
                  Not available
                </span>
              </>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-text-subtle">
        An estimate for one full billing period. An invoice prorates seats by
        the days each employee was active, and Stripe collects the payment.
      </p>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-baseline justify-between gap-3 text-sm font-medium">
        {label}
        <span className={cn("num font-mono text-lg font-semibold")}>
          {value.toLocaleString("en-US")}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-[var(--gl-text)]"
      />
    </label>
  );
}
