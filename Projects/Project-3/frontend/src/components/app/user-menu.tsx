"use client";

import {
  ChevronDown,
  KeyRound,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/cn";

const itemStyles =
  "flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-base outline-none data-[highlighted]:bg-sunken";

/** First letters of the first and last name: enough to tell two people apart at a glance. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = [
    parts[0],
    parts.length > 1 ? parts[parts.length - 1] : undefined,
  ]
    .map((part) => part?.[0] ?? "")
    .join("");
  return (letters || "?").toUpperCase();
}

/** Who is signed in, and the ways out: their own settings, and signing out. */
export function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: "admin" | "employee";
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Account: ${fullName}`}
        className="flex h-9 items-center gap-2 rounded-md pr-1.5 pl-1 outline-none hover:bg-sunken focus-visible:outline-2 focus-visible:outline-focus data-[state=open]:bg-sunken"
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-md border border-text bg-tag text-xs font-bold text-on-tag"
        >
          {initials(fullName)}
        </span>
        <ChevronDown aria-hidden className="size-3.5 text-text-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 w-64 rounded-md border border-line-strong bg-surface p-1.5 shadow-overlay motion-safe:animate-[gl-drop_140ms_var(--ease-out)]"
        >
          <div className="flex flex-col gap-0.5 border-b border-line px-2.5 pt-1.5 pb-2.5">
            <p className="truncate font-semibold">{fullName}</p>
            <p className="truncate text-sm text-text-muted">{email}</p>
            <p className="text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase">
              {role === "admin" ? "Admin" : "Employee"}
            </p>
          </div>
          <div className="pt-1.5">
            <DropdownMenu.Item asChild>
              <Link href="/settings/profile" className={itemStyles}>
                <UserRound aria-hidden className="size-4" />
                Profile
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <Link href="/settings/security" className={itemStyles}>
                <ShieldCheck aria-hidden className="size-4" />
                Password and security
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <Link href="/developers/api-keys" className={itemStyles}>
                <KeyRound aria-hidden className="size-4" />
                API keys
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1.5 h-px bg-line" />
            <form action="/session/logout" method="post">
              <DropdownMenu.Item asChild>
                <button type="submit" className={cn(itemStyles, "text-left")}>
                  <LogOut aria-hidden className="size-4" />
                  Sign out
                </button>
              </DropdownMenu.Item>
            </form>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
