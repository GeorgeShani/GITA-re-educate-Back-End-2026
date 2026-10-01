"use client";

import { Menu, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DocNav } from "./doc-nav";

/** The table of contents below the `lg` breakpoint, in a panel that closes when a guide is chosen. */
export function DocsMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open the table of contents"
        >
          <Menu aria-hidden />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-text/40 motion-safe:animate-[gl-fade_160ms_var(--ease-out)]" />
        <Dialog.Content className="scrollbar-none fixed inset-y-0 left-0 z-50 flex w-[min(20rem,100vw)] flex-col gap-5 overflow-y-auto border-r border-line bg-canvas p-4 shadow-overlay motion-safe:animate-[gl-slide-left_220ms_var(--ease-out)]">
          <div className="flex items-center justify-between">
            <Dialog.Title className="headline text-xl">
              Documentation
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Every guide, grouped by topic
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <DocNav onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
