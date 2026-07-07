import { AnimatePresence, motion } from "framer-motion";
import { CloseIcon, HintIcon } from "@/assets/icons";
import { ProgressSegments } from "@/components/mood-logger/ProgressSegments";
import { stepTransition, fadeRise } from "@/animations/variants";

// Figma node 308:2979 (desktop/tablet) + 354:4505 (mobile) — a single gap
// value (spacing/300=24px mobile, spacing/400=32px tablet+) applies uniformly
// between every top-level child (title, progress bar, heading, body,
// footer), and container padding shrinks on mobile (spacing/250,400 vs
// spacing/500,600). The heading+body region additionally scrolls internally
// (capped at 90vh) since real step content — 20 emotion tags — can exceed any
// fixed Figma frame height, which the static designs don't account for.
export function MoodLoggerShell({ step, totalSteps, onClose, heading, subheading, children, footer, error }) {
  return (
    <div className="relative flex max-h-[90vh] w-full flex-col gap-6 rounded-2xl bg-page-gradient px-5 py-8 tablet:gap-8 tablet:px-10 tablet:py-12">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-7.5 right-7.5 text-neutral-600"
      >
        <CloseIcon className="size-4" />
      </button>

      <div className="flex shrink-0 flex-col gap-6 tablet:gap-8">
        <h2 className="text-preset-2 text-neutral-900">Log your mood.</h2>
        <ProgressSegments total={totalSteps} current={step} />
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          {...stepTransition}
          className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto tablet:gap-8 scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex flex-col gap-1">
            <h3 className="text-preset-3 text-neutral-900">{heading}</h3>
            {subheading && <p className="text-preset-6 text-neutral-600">{subheading}</p>}
          </div>
          {children}
        </motion.div>
      </AnimatePresence>

      <div className="flex shrink-0 flex-col gap-4">
        <AnimatePresence>
          {error && (
            <motion.div key="error" {...fadeRise} className="flex items-center gap-1.5 text-preset-7 text-red-700">
              <HintIcon className="size-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {footer}
      </div>
    </div>
  );
}
