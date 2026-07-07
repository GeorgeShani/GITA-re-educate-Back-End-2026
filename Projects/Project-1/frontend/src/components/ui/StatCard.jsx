import pattern from "@/assets/pattern.svg";
import { ArrowRightIcon, ArrowRightUpIcon, ArrowRightDownIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";

const TREND_ICONS = {
  increase: ArrowRightUpIcon,
  decrease: ArrowRightDownIcon,
  same: ArrowRightIcon,
};

// Figma "Average Mood Section" / "Average Sleep Section" panel — empty state
// (246:1776/246:1795 + responsive equivalents) and populated states
// (354:8543/8812/9081/9350/9619, 152:2405). Height is fixed (150px) on
// Tablet/Mobile but stretches to fill available space on Desktop (flex-1),
// matching how it sits beside the Trends chart there.
//
// `radius` differs between empty (rounded-2xl) and populated (rounded-3xl)
// states per Figma; `mutedDescription` (opacity-70) is true for both empty
// states and the populated Sleep panel, but false for the populated Mood
// panel — confirmed consistently across all 6 populated Figma examples.
export function StatCard({
  title,
  subtitle,
  background,
  textColor = "text-neutral-900",
  radius = "rounded-3xl",
  icon,
  heading,
  trend,
  description,
  mutedDescription = false,
  className,
}) {
  const TrendIcon = trend ? TREND_ICONS[trend] : null;

  return (
    <div className={cn("flex w-full shrink-0 flex-col gap-3 desktop:min-h-px desktop:flex-1", className)}>
      <p className="text-preset-5 text-neutral-900">
        {title} <span className="text-preset-7 text-neutral-600">{subtitle}</span>
      </p>
      <div
        className={cn(
          "relative flex h-37.5 w-full shrink-0 flex-col items-start justify-center gap-3 overflow-hidden px-4 py-5 tablet:px-5 desktop:h-auto desktop:flex-1 desktop:py-5",
          radius,
          background,
        )}
      >
        <div className={cn("relative flex items-center justify-center gap-4", textColor)}>
          {icon}
          <p className="text-preset-4">{heading}</p>
        </div>
        <div className={cn("relative flex w-full items-start gap-2", mutedDescription && "opacity-70")}>
          {TrendIcon && <TrendIcon className={cn("size-4 shrink-0", textColor)} />}
          <p className={cn("flex-1 text-preset-7 relative z-10", textColor)}>{description}</p>
        </div>
        <div className="absolute inset-y-0 right-0 w-16 overflow-hidden">
          <img src={pattern} alt="" className="h-full w-full object-cover" />
        </div>
      </div>
    </div>
  );
}
