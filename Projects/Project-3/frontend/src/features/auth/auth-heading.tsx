import { CircleCheck, Info } from "lucide-react";
import type { ReactNode } from "react";

/** The title of an auth page: one condensed line, and the sentence that says what happens here. */
export function AuthHeading({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <h1 className="headline text-4xl leading-[0.98]">{title}</h1>
      {children ? <p className="text-text-muted">{children}</p> : null}
    </div>
  );
}

/** A line above the form: good news (a password was changed) or plain information (you were signed out). */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "pass";
  children: ReactNode;
}) {
  const Icon = tone === "pass" ? CircleCheck : Info;
  return (
    <output
      className={
        tone === "pass"
          ? "flex gap-2.5 rounded-md border border-pass bg-pass-soft p-3 text-sm font-medium text-pass"
          : "flex gap-2.5 rounded-md border border-line-strong bg-sunken p-3 text-sm font-medium"
      }
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </output>
  );
}

/** Next hands a repeated query parameter over as a list; the pages only ever want the first. */
export function first(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
