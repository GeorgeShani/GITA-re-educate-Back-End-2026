import { forwardRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HintIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";
import { fadeRise } from "@/animations/variants";

// Modeled on TextField.jsx's pattern (Figma Input component states map to
// native pseudo-classes, same shadow/focus-ring tokens). Only Default was
// shown in Figma for this component (reflection journal, node 308:3053) —
// hover/error are a reasonable extrapolation for interactive consistency,
// not literal Figma values. Placeholder italic+medium styling IS the
// confirmed Figma spec, not a guess. Optional `maxLength` + `value` renders
// a right-aligned character counter, a generically reusable textarea
// feature rather than a one-off hack for this screen.
export const TextArea = forwardRef(function TextArea(
  { className, error, id, maxLength, value, disabled, onFocus, ...props },
  ref,
) {
  const errorId = error && id ? `${id}-error` : undefined;
  const showCounter = typeof maxLength === "number" && typeof value === "string";

  // Scrolls itself fully into view on focus — the field lives inside the
  // Mood Logger's scrollable step region, and a fixed-height textarea can
  // otherwise end up partially clipped above/below the visible area.
  function handleFocus(event) {
    onFocus?.(event);
    event.target.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div className="flex w-full flex-col p-1.5 gap-2">
      <textarea
        ref={ref}
        id={id}
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        onFocus={handleFocus}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        className={cn(
          "w-full resize-none rounded-lg border bg-neutral-0 px-4 py-3 text-preset-6-regular text-neutral-900 shadow-input transition duration-150",
          "scrollbar-none [&::-webkit-scrollbar]:hidden",
          "placeholder:font-medium placeholder:text-neutral-600 placeholder:italic",
          "focus:border-neutral-300 focus:shadow-focus-ring focus:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-60",
          error ? "border-red-700" : "border-neutral-300 enabled:hover:border-neutral-600",
          className,
        )}
        {...props}
      />
      {showCounter && (
        <p className="text-right text-preset-8 text-neutral-600">
          {value.length}/{maxLength}
        </p>
      )}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            id={errorId}
            {...fadeRise}
            className="flex items-center gap-1.5 text-preset-9 text-red-700"
          >
            <HintIcon className="size-3 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
