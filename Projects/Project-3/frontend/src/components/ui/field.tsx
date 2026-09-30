import { cva } from "class-variance-authority";
import type { ComponentProps, ReactNode } from "react";
import { useId } from "react";
import { cn } from "@/lib/cn";

export const inputStyles = cva(
  [
    "h-9 w-full rounded-md border border-line-strong bg-surface px-3 text-base text-text",
    "placeholder:text-text-subtle",
    "transition-colors duration-(--duration-fast)",
    "hover:border-text-subtle focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0",
    "disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-60",
    "aria-invalid:border-hold aria-invalid:focus-visible:outline-hold",
  ],
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputStyles(), className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputStyles(), "h-auto min-h-24 py-2", className)} {...props} />;
}

interface FieldProps {
  label: string;
  /** Plain-language help under the label. */
  hint?: string;
  /** The problem AND the way out: "Enter the address from your invitation." */
  error?: string;
  children: (control: { id: string; "aria-describedby": string | undefined; "aria-invalid": boolean | undefined }) => ReactNode;
  className?: string;
}

/** A label, a control, a hint, and an error: wired together so a screen reader hears all four. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="-mt-0.5 text-sm text-text-muted">
          {hint}
        </p>
      ) : null}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-hold">
          {error}
        </p>
      ) : null}
    </div>
  );
}
