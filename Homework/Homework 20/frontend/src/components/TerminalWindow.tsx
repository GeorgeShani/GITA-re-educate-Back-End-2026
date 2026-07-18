import type { ReactNode } from "react";

interface TerminalWindowProps {
  filename: string;
  children: ReactNode;
  className?: string;
}

/** A card styled like a code editor window: traffic-light dots + a filename tab. */
export function TerminalWindow({ filename, children, className = "" }: TerminalWindowProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-term-border bg-term-panel/90 shadow-[0_0_30px_-10px_rgba(57,255,20,0.25)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-term-border bg-black/30 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-term-red/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-term-amber/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-term-green/80" />
        <span className="ml-2 truncate text-xs text-term-muted">{filename}</span>
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
