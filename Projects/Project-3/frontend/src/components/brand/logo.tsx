import { cn } from "@/lib/cn";

interface MarkProps {
  className?: string;
  /** Accessible name. Omit when a visible wordmark already names the product. */
  title?: string;
}

/**
 * The Gridline mark: an ink tile holding a 2×2 grid of label-stock cells. The top-right cell is the hi-vis
 * inspection tag, grommet punched: the one file that has been checked. Same geometry as the generated `app/icon.svg`;
 * the tile and cells swap with the theme so the mark reads on light and dark grounds alike.
 */
export function Mark({ className, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-7 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="6" fill="var(--gl-text)" />
      <rect
        x="5.5"
        y="5.5"
        width="9.5"
        height="9.5"
        rx="1.5"
        fill="var(--gl-canvas)"
      />
      <rect
        x="17"
        y="5.5"
        width="9.5"
        height="9.5"
        rx="1.5"
        fill="var(--gl-tag)"
      />
      <rect
        x="5.5"
        y="17"
        width="9.5"
        height="9.5"
        rx="1.5"
        fill="var(--gl-canvas)"
      />
      <rect
        x="17"
        y="17"
        width="9.5"
        height="9.5"
        rx="1.5"
        fill="var(--gl-canvas)"
      />
      <circle cx="21.75" cy="10.25" r="1.7" fill="var(--gl-text)" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
}

/** Mark and wordmark, set in Archivo at its widest, heaviest cut: stencil-like, like lettering on a crate. */
export function Logo({ className, markClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Mark className={markClassName} />
      <span className="width-display text-lg leading-none font-extrabold tracking-[-0.025em]">
        Gridline
      </span>
    </span>
  );
}
