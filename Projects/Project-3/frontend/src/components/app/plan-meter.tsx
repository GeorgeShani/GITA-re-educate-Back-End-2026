import Link from "next/link";

export interface PlanSummary {
  name: string;
  filesUsed: number;
  filesLimit: number;
}

/**
 * How much of this period's file quota is used, at the foot of the rail where it is always in view. It turns the caution
 * colour near the limit and the hold colour past it, and says the number: the bar alone is never the message.
 */
export function PlanMeter({
  plan,
  canManage,
}: {
  plan: PlanSummary;
  canManage: boolean;
}) {
  const share = plan.filesLimit > 0 ? plan.filesUsed / plan.filesLimit : 0;
  const tone = share >= 1 ? "bg-hold" : share >= 0.8 ? "bg-caution" : "bg-text";
  const content = (
    <>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{plan.name} plan</span>
        <span className="num font-mono text-xs text-text-muted">
          {plan.filesUsed.toLocaleString("en-US")} /{" "}
          {plan.filesLimit.toLocaleString("en-US")}
        </span>
      </span>
      <span
        role="progressbar"
        aria-label="Files used this billing period"
        aria-valuemin={0}
        aria-valuemax={plan.filesLimit}
        aria-valuenow={Math.min(plan.filesUsed, plan.filesLimit)}
        className="block h-1.5 overflow-hidden rounded-full bg-sunken"
      >
        <span
          style={{ width: `${Math.min(1, share) * 100}%` }}
          className={`block h-full rounded-full ${tone}`}
        />
      </span>
      <span className="text-xs text-text-muted">Files this billing period</span>
    </>
  );
  const className = "leaf flex flex-col gap-2 p-3";
  return canManage ? (
    <Link
      href="/billing"
      className={`${className} hover:bg-sunken`}
      aria-label={`${plan.name} plan: ${plan.filesUsed} of ${plan.filesLimit} files used. Open billing`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
