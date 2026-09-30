"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { Dialog } from "radix-ui";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DemoButton } from "./demo-button";
import { API_REFERENCE_HREF, MAIN_LINKS, PRODUCT_LINKS } from "./nav-data";

const rowStyles =
  "flex min-h-11 items-center rounded-md px-3 text-md font-medium hover:bg-sunken";

/** The navigation below the `lg` breakpoint: a full-height panel with every link and both actions. */
export function MobileMenu() {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open menu"
        >
          <Menu aria-hidden />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-text/40 motion-safe:animate-[gl-fade_160ms_var(--ease-out)]" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(24rem,100vw)] flex-col gap-6 overflow-y-auto border-l border-line bg-canvas p-5 shadow-overlay motion-safe:animate-[gl-slide_220ms_var(--ease-out)]">
          <div className="flex items-center justify-between">
            <Dialog.Title asChild>
              <Logo />
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              Site navigation
            </Dialog.Description>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Close menu">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>

          <nav aria-label="Product" className="flex flex-col gap-0.5">
            <p className="px-3 pb-1 text-sm font-semibold text-text-muted">
              Product
            </p>
            {PRODUCT_LINKS.map(({ href, label, icon: Icon }) => (
              <Dialog.Close asChild key={href}>
                <Link href={href} className={rowStyles}>
                  <Icon aria-hidden className="mr-3 size-4.5 text-text" />
                  {label}
                </Link>
              </Dialog.Close>
            ))}
          </nav>

          <nav aria-label="Site" className="flex flex-col gap-0.5 ruled pb-6">
            {MAIN_LINKS.map(({ href, label }) => (
              <Dialog.Close asChild key={href}>
                <Link href={href} className={rowStyles}>
                  {label}
                </Link>
              </Dialog.Close>
            ))}
            <a href={API_REFERENCE_HREF} className={rowStyles}>
              API reference
            </a>
          </nav>

          <div className="mt-auto flex flex-col gap-2">
            <Button variant="primary" size="lg" asChild>
              <Link href="/register">Start free</Link>
            </Button>
            <DemoButton size="lg" block />
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
