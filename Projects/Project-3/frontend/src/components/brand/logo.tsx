import { cn } from "@/lib/cn";

interface MarkProps {
  className?: string;
  /** Accessible name. Omit when a visible wordmark already names the product. */
  title?: string;
}

/**
 * The Gridline mark: a box-board square ruled into four cells, one cell holding the file (manila).
 * Same geometry as the generated `app/icon.svg`; colours come from the live theme.
 */
export function Mark({ className, title }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-6 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="4" fill="var(--gl-field)" />
      <rect x="17.5" y="5" width="9.5" height="9.5" rx="1" fill="var(--gl-folder)" />
      <path d="M16 5v22M5 16h22" stroke="var(--gl-on-field)" strokeWidth="2" />
      <rect
        x="5"
        y="5"
        width="22"
        height="22"
        rx="1.5"
        fill="none"
        stroke="var(--gl-on-field)"
        strokeWidth="2"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  markClassName?: string;
}

/** Mark and wordmark, set in Archivo at display width. */
export function Logo({ className, markClassName }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Mark className={markClassName} />
      <span className="width-display text-lg leading-none font-bold tracking-[-0.02em]">
        Gridline
      </span>
    </span>
  );
}
