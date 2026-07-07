import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";
import { tapScale, popIn } from "@/animations/variants";

// Figma "Tag" component (node 173:3288): "Tag checkbox" (checkbox, sm, auto
// width) and "Tag radio" (radio, lg, fixed width, bolder label) — the two
// combinations actually shown in the design system. Built on a visually
// hidden native <input type="checkbox|radio"> inside a <label> (the `peer`
// pattern) rather than the Figma-generated <button role="...">, so keyboard
// toggling, form association, and screen-reader semantics come for free from
// the native element instead of being reimplemented.
export function Tag({ className, variant = "checkbox", checked = false, disabled, children, ...props }) {
  const isRadio = variant === "radio";

  return (
    <motion.label
      whileTap={disabled ? undefined : tapScale.whileTap}
      transition={tapScale.transition}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-lg border-2 py-3 transition bg-neutral-0",
        isRadio ? "w-44 gap-3 px-5" : "justify-center px-4",
        // Figma spec is border-blue-100 here (barely visible against white);
        // bumped to blue-200 for legibility per user request — a deliberate
        // deviation, not a Figma value.
        checked ? "border-blue-600" : "border-blue-200",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        type={isRadio ? "radio" : "checkbox"}
        checked={checked}
        disabled={disabled}
        className="peer sr-only"
        {...props}
      />
      {isRadio ? (
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
      ) : (
        <span
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-xs transition-colors",
            checked ? "bg-blue-600" : "border-[1.5px] border-blue-200 bg-neutral-0",
            "peer-focus-visible:shadow-focus-ring",
          )}
        >
          <AnimatePresence>
            {checked && (
              <motion.span key="check" {...popIn} className="flex">
                <CheckIcon className="size-3 text-neutral-0" strokeWidth={3} />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      )}
      <span className={cn("text-neutral-900", isRadio ? "flex-1 text-preset-5" : "text-preset-6-regular")}>
        {children}
      </span>
    </motion.label>
  );
}
