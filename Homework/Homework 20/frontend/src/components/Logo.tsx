interface LogoProps {
  className?: string;
}

/** The app mark: a terminal-prompt glyph paired with the wordmark. */
export function Logo({ className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-term-green/60 bg-term-green/10 font-bold text-term-green text-glow">
        &gt;_
      </span>
      <span className="text-lg font-semibold text-term-green text-glow">
        cs-quiz.arena
      </span>
    </div>
  );
}
