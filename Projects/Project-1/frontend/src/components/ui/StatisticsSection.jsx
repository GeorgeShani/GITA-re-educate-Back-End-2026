import { cn } from "@/utils/cn";

// Figma "Average Mood Section" outer wrapper (nodes 246:1775 / 311:8883 /
// 311:9164) — bordered card holding two StatCard panels (mood + sleep).
// Padding differs slightly per breakpoint per Figma: Mobile px-4/py-5,
// Tablet px-5/py-6, Desktop p-6 uniform.
export function StatisticsSection({ children, className }) {
  return (
    <div
      className={cn(
        "flex size-full flex-col gap-6 rounded-2xl border border-blue-100 bg-neutral-0 px-4 py-5 tablet:px-5 tablet:py-6 desktop:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
