"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import type { Role } from "./nav";
import { NavList } from "./rail-nav";

/** The navigation below the `lg` breakpoint: the same list as the rail, in a panel that closes when a page is chosen. */
export function MobileNav({
  role,
  companyName,
}: {
  role: Role;
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open navigation"
        >
          <Menu aria-hidden />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-text/40 motion-safe:animate-[gl-fade_160ms_var(--ease-out)]" />
        <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,100vw)] flex-col gap-6 overflow-y-auto scrollbar-none border-r border-line bg-canvas p-4 shadow-overlay motion-safe:animate-[gl-slide-left_220ms_var(--ease-out)]">
          <div className="flex items-center justify-between">
            <Dialog.Title asChild>
              <Link href="/dashboard" onClick={() => setOpen(false)}>
                <Logo />
              </Link>
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Navigation for {companyName}
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close navigation">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <NavList role={role} onNavigate={() => setOpen(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
