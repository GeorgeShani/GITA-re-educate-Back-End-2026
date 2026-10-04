import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/api/plans";
import { limit, overageLine, PLAN_LABEL, priceLine } from "./plan-copy";

interface Row {
  label: string;
  value: (plan: Plan) => string;
}

const ROWS: Row[] = [
  {
    label: "Files a billing period",
    value: (plan) => plan.filesPerPeriod.toLocaleString("en-US"),
  },
  { label: "Past the file quota", value: overageLine },
  { label: "Employees", value: (plan) => limit(plan.maxEmployees) },
  { label: "Quality rules", value: (plan) => limit(plan.maxQualityRules) },
  {
    label: "Versions of one file",
    value: (plan) => limit(plan.maxVersionsPerDataset),
  },
  {
    label: "Questions to the AI assistant a billing period",
    value: (plan) => plan.questionsPerPeriod.toLocaleString("en-US"),
  },
  {
    label: "API requests a minute, shared by everyone",
    value: (plan) => plan.rateLimitPerMinute.toLocaleString("en-US"),
  },
];

/** The plans side by side, straight from the catalog. A table, because it is a comparison. */
export function PlanTable({ plans }: { plans: Plan[] }) {
  return (
    <div className="leaf overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <caption className="sr-only">Gridline plans compared</caption>
        <thead>
          <tr className="border-b border-line-strong align-top">
            <th scope="col" className="w-[26%] p-5" />
            {plans.map((plan) => (
              <th key={plan.plan} scope="col" className="p-5">
                <span className="headline block text-3xl leading-none">
                  {PLAN_LABEL[plan.plan]}
                </span>
                <span className="num mt-2 block font-mono text-sm font-medium">
                  {priceLine(plan)}
                </span>
                <Button
                  variant={plan.plan === "free" ? "primary" : "secondary"}
                  size="md"
                  className="mt-4"
                  asChild
                >
                  <Link href={`/register?plan=${plan.plan}`}>
                    {plan.plan === "free"
                      ? "Start free"
                      : `Start on ${PLAN_LABEL[plan.plan]}`}
                  </Link>
                </Button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr
              key={row.label}
              className="border-b border-line last:border-b-0"
            >
              <th
                scope="row"
                className="p-5 text-sm font-medium text-text-muted"
              >
                {row.label}
              </th>
              {plans.map((plan) => (
                <td key={plan.plan} className="num p-5 font-mono text-sm">
                  {row.value(plan)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
