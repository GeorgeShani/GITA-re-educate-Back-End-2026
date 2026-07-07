import { SleepIcon } from "@/assets/icons";
import { SLEEP_OPTIONS } from "@/constants/sleepOptions";
import { cn } from "@/utils/cn";

// Figma "Sleep Container" (151:449 desktop, 347:5721 tablet, 349:3807
// mobile) — identical across all 3 breakpoints, no responsive classes
// needed. `hours` is a SLEEP_OPTIONS value (e.g. "9+"); its `label` already
// includes the "hours" suffix ("9+ hours"), so it's used as-is.
export function SleepCard({ hours, className }) {
  const label = SLEEP_OPTIONS.find((option) => option.value === hours)?.label ?? "—";

  return (
    <div className={cn("flex w-full flex-col gap-4 rounded-2xl border border-blue-100 bg-neutral-0 p-5", className)}>
      <div className="flex items-center gap-3">
        <SleepIcon className="size-5.5 text-neutral-600" />
        <p className="text-preset-6 text-neutral-600">Sleep</p>
      </div>
      <p className="text-preset-3 text-neutral-900">{label}</p>
    </div>
  );
}
