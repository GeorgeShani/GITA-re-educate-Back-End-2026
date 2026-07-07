import { AnimatePresence, motion } from "framer-motion";
import { tapScale, popIn } from "@/animations/variants";
import { cn } from "@/utils/cn";

// Full-width single-select row (Mood Logger Steps 1 & 4, Figma nodes
// 308:2801/308:3088) — structurally different from Tag's pill-shaped radio
// variant (full bleed row vs fixed width, optional trailing icon), so it's a
// sibling component rather than another Tag prop-flag. Reuses Tag's
// accessible pattern: visually-hidden native <input type="radio"> + `peer`.
// `paddingY` is explicit rather than a fixed default because Figma uses
// different vertical padding per step (py-3 for Step 1, py-4 for Step 4) —
// a genuine per-usage difference, not one to normalize away.
export function RadioRow({ name, checked = false, disabled, icon, paddingY = "py-4", className, children, ...props }) {
  return (
    <motion.label
      whileTap={disabled ? undefined : tapScale.whileTap}
      transition={tapScale.transition}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 rounded-lg border-2 px-5 transition bg-neutral-0",
        paddingY,
        checked ? "border-blue-600" : "border-blue-200",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors",
          checked ? "bg-blue-600" : "border-[1.5px] border-blue-200 bg-neutral-0",
          "peer-focus-visible:shadow-focus-ring",
        )}
      >
        <AnimatePresence>
          {checked && <motion.span key="dot" {...popIn} className="size-2.5 rounded-full bg-neutral-0" />}
        </AnimatePresence>
      </span>
      <span className="flex-1 text-preset-5 text-neutral-900">{children}</span>
      {icon}
    </motion.label>
  );
}
