import { forwardRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HintIcon, EyeIcon, EyeOffIcon } from "@/assets/icons";
import { cn } from "@/utils/cn";
import { fadeRise } from "@/animations/variants";

// Figma "Input" component (node 161:676). States map to native pseudo-classes
// rather than JS-tracked booleans: Default/Hover/Focus are :hover/:focus,
// "Active" (Figma's filled-with-value example) is CSS :not(:placeholder-shown).
// Disabled has no Figma spec — opacity + cursor-not-allowed is a reasonable
// extrapolation, not a literal Figma value.
//
// type="password" gets a show/hide toggle (not in the Figma spec, added per
// request) — toggling only swaps the native input type, no Figma value.
export const TextField = forwardRef(function TextField(
  { className, error, id, type = "text", disabled, ...props },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const errorId = error && id ? `${id}-error` : undefined;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={isPassword && revealed ? "text" : type}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={errorId}
          className={cn(
            "w-full rounded-lg border bg-neutral-0 px-4 py-3 text-preset-6-regular text-neutral-900 shadow-input transition duration-150 placeholder:text-neutral-600",
            "focus:border-neutral-300 focus:shadow-focus-ring focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60",
            isPassword && "pr-12",
            error
              ? "border-red-700"
              : "border-neutral-300 enabled:hover:border-neutral-600 not-placeholder-shown:border-neutral-600 not-placeholder-shown:focus:border-neutral-300",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRevealed((value) => !value)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-4 -translate-y-1/2 text-neutral-600 disabled:cursor-not-allowed"
          >
            {revealed ? (
              <EyeOffIcon className="size-5" />
            ) : (
              <EyeIcon className="size-5" />
            )}
          </button>
        )}
      </div>
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
