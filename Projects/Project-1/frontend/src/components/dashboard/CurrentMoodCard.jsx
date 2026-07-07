import { MOODS } from "@/constants/moods";
import { QuoteIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";

// Figma "Current Mood" card (desktop/tablet 361:10287 + per-mood variants
// 311:6590/7241/7570/7900, mobile 361:10490). Desktop and Tablet share the
// same horizontal layout (icon absolutely positioned on the right); Mobile
// stacks everything centered instead, with the icon in normal flow between
// the heading and the quote — one responsive markup switching at the
// `tablet:` breakpoint, not duplicated JSX per breakpoint.
export function CurrentMoodCard({ mood, quote, className }) {
  const { label, icon } = MOODS[mood];

  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center gap-8 overflow-hidden rounded-2xl border border-blue-100 bg-neutral-0 px-4 py-8 text-center",
        "tablet:items-start tablet:justify-between tablet:gap-0 tablet:p-8 tablet:text-left",
        className,
      )}
    >
      <div className="flex flex-col font-bold tracking-[-0.3px] text-neutral-900">
        <p className="text-preset-3 opacity-70">I'm feeling</p>
        <p className="text-preset-2">{label}</p>
      </div>

      <img
        src={icon}
        alt=""
        className="size-50 shrink-0 tablet:absolute tablet:right-8 tablet:top-1/2 tablet:size-80 tablet:-translate-y-1/2"
      />

      <div className="flex flex-col items-center gap-3 tablet:w-61.5 tablet:items-start">
        <QuoteIcon className="size-6 text-blue-300" />
        <p className="text-preset-6-italic text-neutral-900">{quote}</p>
      </div>
    </div>
  );
}
