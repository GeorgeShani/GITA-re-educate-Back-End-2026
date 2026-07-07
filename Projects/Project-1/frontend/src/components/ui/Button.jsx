import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";
import { tapScale } from "@/animations/variants";

// Figma "Button" component (node 161:687): primary (161:691 + states) and
// "Secondary Button" (167:723 + states). Merged into one component per the
// "variants via props, not duplicated components" rule. Disabled has no
// Figma spec for the secondary variant — opacity + cursor-not-allowed is a
// reasonable extrapolation, not a literal Figma value.
// `size="lg"` is the larger primary CTA seen in the Mood Logger's
// Continue/Submit button (24px text, more padding) — a real Figma variant,
// not a guess. Secondary only has one size so far.
const PRIMARY_BASE = cn(
  "text-neutral-0 bg-blue-600 enabled:hover:bg-blue-700",
  "focus-visible:shadow-focus-ring focus-visible:outline-none",
  "disabled:bg-blue-200 disabled:cursor-not-allowed",
);

const VARIANT_CLASSES = {
  primary: {
    md: cn(PRIMARY_BASE, "rounded-lg px-8 py-3 text-preset-5"),
    lg: cn(PRIMARY_BASE, "rounded-lg px-8 py-4 text-preset-4"),
  },
  secondary: {
    md: cn(
      "rounded-md border border-neutral-300 bg-neutral-0 px-4 py-2 text-preset-6 text-neutral-900 shadow-xs",
      "enabled:hover:border-neutral-900",
      "focus-visible:border-neutral-600 focus-visible:shadow-focus-ring focus-visible:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-60",
    ),
  },
};

export const Button = forwardRef(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={tapScale.whileTap}
      transition={tapScale.transition}
      className={cn(
        "inline-flex items-center justify-center gap-2 text-center transition duration-150",
        VARIANT_CLASSES[variant][size] ?? VARIANT_CLASSES[variant].md,
        className,
      )}
      {...props}
    />
  );
});
