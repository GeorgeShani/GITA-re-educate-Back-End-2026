import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/cn";
import { cssVars } from "@/lib/css-vars";
import { HUES, type Hue } from "./hues";

interface ExhibitProps {
  /** The division's id: the anchor the header menu links to. */
  id: string;
  /** The division's hue: the top edge of its leaf. */
  hue: Hue;
  title: string;
  children: ReactNode;
  /** The leaf that proves the claim. */
  visual: ReactNode;
  /** Put the leaf on the left at wide widths. */
  flip?: boolean;
}

/** One division of the manual: a printed claim beside a leaf that proves it. */
export function Exhibit({
  id,
  hue,
  title,
  children,
  visual,
  flip = false,
}: ExhibitProps) {
  return (
    <section
      id={id}
      style={cssVars({ "--division": `var(${HUES[hue].cssVar})` })}
      className="scroll-mt-16 border-t border-line"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:gap-16 md:py-20">
        <Reveal
          className={cn("flex min-w-0 flex-col gap-5", flip && "md:order-2")}
        >
          <h2 className="headline text-4xl leading-[0.98] sm:text-5xl">
            {title}
          </h2>
          <div className="copy max-w-prose text-text-muted [&_strong]:font-semibold [&_strong]:text-text">
            {children}
          </div>
        </Reveal>
        <Reveal delay={120} className={cn("min-w-0", flip && "md:order-1")}>
          {visual}
        </Reveal>
      </div>
    </section>
  );
}

/** A leaf: hairline-outlined, one short hard shadow, and a top edge in its division's hue. */
export function Panel({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure
      style={{
        borderTopWidth: 5,
        borderTopColor: "var(--division, var(--gl-line-strong))",
      }}
      className={cn("leaf flex flex-col gap-4 p-5", className)}
    >
      <figcaption className="text-sm font-semibold text-text-muted">
        {label}
      </figcaption>
      {children}
    </figure>
  );
}
