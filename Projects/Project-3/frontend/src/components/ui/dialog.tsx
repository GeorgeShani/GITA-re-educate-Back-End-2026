"use client";

import { X } from "lucide-react";
import { Dialog as Radix } from "radix-ui";
import type { ReactNode } from "react";
import { Button } from "./button";

/**
 * A modal sheet: dims the page, traps focus, closes on Escape and on the close button. Radix does the focus work, so
 * the first thing a keyboard user lands on is inside the dialog and the page behind it cannot be reached.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Radix.Root open={open} onOpenChange={onOpenChange}>
      <Radix.Portal>
        <Radix.Overlay className="fixed inset-0 z-40 bg-text/40 motion-safe:animate-[gl-fade_160ms_var(--ease-out)]" />
        <Radix.Content
          className="fixed top-[10vh] left-1/2 z-50 flex max-h-[80vh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-line-strong bg-surface shadow-overlay motion-safe:animate-[gl-drop_160ms_var(--ease-out)]"
          // Radix warns when a dialog has no description; saying so here is the documented way to opt out.
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <Radix.Title className="headline text-2xl leading-tight">
                {title}
              </Radix.Title>
              {description ? (
                <Radix.Description className="text-text-muted">
                  {description}
                </Radix.Description>
              ) : null}
            </div>
            <Radix.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X aria-hidden />
              </Button>
            </Radix.Close>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </div>
        </Radix.Content>
      </Radix.Portal>
    </Radix.Root>
  );
}
