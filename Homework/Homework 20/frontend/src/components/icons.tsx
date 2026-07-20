interface IconProps {
  className?: string;
}

/** Small monochrome line icons for states normally rendered with Unicode
 * glyphs (checkmarks, arrows, etc.), kept as real SVG so they render
 * identically everywhere instead of depending on font glyph coverage. */

export function CheckIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 8.5L6.5 12L13 4" />
    </svg>
  );
}

export function XIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function CircleIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className={className}
    >
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function ChevronDownIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = "" }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M13 8H3M7 4L3 8l4 4" />
    </svg>
  );
}

/** A solid block cursor, sized relative to the surrounding font: replaces
 * the block-glyph character so its exact shape and width no longer depend on the font. */
export function CursorBlock({ className = "" }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-[1em] w-[0.4em] animate-blink bg-current ${className}`}
    />
  );
}
