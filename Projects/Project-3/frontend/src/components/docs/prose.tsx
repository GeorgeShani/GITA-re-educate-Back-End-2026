import type { ReactNode } from "react";
import { CopyButton } from "@/components/marketing/exhibits/copy-button";
import { cn } from "@/lib/cn";

/**
 * The body of a guide. Plain sans text at reading size, headings in Archivo (sentence case, so they scan), code in the data face. A guide writes plain `h2`/`h3` (each with an `id`), `p`, `ul`, `ol`, `a` and `code`, and gets all of it.
 */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-5",
        "[&_h2]:mt-8 [&_h2]:scroll-mt-20 [&_h2]:border-t [&_h2]:border-line [&_h2]:pt-6 [&_h2]:text-2xl [&_h2]:font-extrabold",
        "[&_h3]:mt-4 [&_h3]:scroll-mt-20 [&_h3]:text-lg [&_h3]:font-bold",
        "[&_p]:text-md [&_li]:text-md [&_p]:leading-relaxed [&_li]:leading-relaxed [&_p]:text-text [&_li]:text-text",
        "[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-6 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5 [&_ol]:pl-6",
        "[&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:decoration-2",
        "[&_:not(pre)>code]:rounded-xs [&_:not(pre)>code]:border [&_:not(pre)>code]:border-line [&_:not(pre)>code]:bg-sunken [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.85em]",
        // A long path in inline code (`POST /outgoing-webhooks/deliveries/{deliveryId}/redeliver`) must wrap, not push the page wide.
        "[&_:not(pre)>code]:[overflow-wrap:anywhere]",
        "[&_strong]:font-semibold",
      )}
    >
      {children}
    </div>
  );
}

/** A block of code or a command, with a Copy button. `language` is a label for people, not a highlighter. */
export function Code({
  children,
  label,
}: {
  children: string;
  label?: string;
}) {
  return (
    <figure className="leaf overflow-hidden">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line bg-sunken px-3 py-1">
        <span className="font-mono text-xs text-text-muted">
          {label ?? "shell"}
        </span>
        <CopyButton text={children} label={`Copy ${label ?? "the command"}`} />
      </figcaption>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <code>{children}</code>
      </pre>
    </figure>
  );
}
