import { cva, type VariantProps } from "class-variance-authority";
import { Check, CircleAlert, CircleDashed, Lock, TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The status vocabulary. Every state is a rubber stamp: a condensed, uppercase word inside a ruled frame, and ALWAYS a
 * drawn icon beside it, so meaning is never carried by colour alone (WCAG 1.4.1).
 *
 *   pass     stamp green   passed, within quota, succeeded, paid
 *   hold     vermilion     failed, over limit, restricted, overdue
 *   caution  umber         approaching a limit, warning-severity rule
 *   live     sodium amber  BEING PROFILED RIGHT NOW. Nothing else may use it.
 *   idle     ink           neutral record: queued, unsupported, draft
 */
export const stampStyles = cva(
  "width-stamp inline-flex h-6 shrink-0 items-center gap-1 rounded-xs border px-1.5 text-xs font-semibold uppercase tracking-[0.06em] [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        pass: "border-pass bg-pass-soft text-pass",
        hold: "border-hold bg-hold-soft text-hold",
        caution: "border-caution bg-caution-soft text-caution",
        live: "border-live bg-live-soft text-live-ink",
        idle: "border-line-strong bg-sunken text-text-muted",
      },
    },
    defaultVariants: { tone: "idle" },
  },
);

type Tone = NonNullable<VariantProps<typeof stampStyles>["tone"]>;

const ICONS: Record<Tone, ReactNode> = {
  pass: <Check aria-hidden strokeWidth={2.5} />,
  hold: <CircleAlert aria-hidden strokeWidth={2.25} />,
  caution: <TriangleAlert aria-hidden strokeWidth={2.25} />,
  live: <CircleDashed aria-hidden strokeWidth={2.25} className="motion-safe:animate-[gl-live_1.4s_ease-in-out_infinite]" />,
  idle: <Lock aria-hidden className="hidden" />,
};

export interface StampProps extends ComponentProps<"span">, VariantProps<typeof stampStyles> {
  /** Override the drawn icon (for example a padlock on a restricted file). */
  icon?: ReactNode;
}

export function Stamp({ tone = "idle", icon, className, children, ...props }: StampProps) {
  return (
    <span className={cn(stampStyles({ tone }), className)} {...props}>
      {icon ?? ICONS[tone ?? "idle"]}
      {children}
    </span>
  );
}
