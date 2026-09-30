"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavigationMenu } from "radix-ui";
import { cn } from "@/lib/cn";
import { API_REFERENCE_HREF, MAIN_LINKS, PRODUCT_LINKS } from "./nav-data";

const linkStyles =
  "inline-flex h-9 items-center rounded-md px-3 text-base font-medium text-text-muted transition-colors duration-(--duration-fast) hover:bg-sunken hover:text-text";

export function DesktopNav() {
  const pathname = usePathname();

  return (
    <NavigationMenu.Root className="relative hidden lg:block">
      <NavigationMenu.List className="flex items-center gap-0.5">
        <NavigationMenu.Item className="relative">
          <NavigationMenu.Trigger
            className={cn(
              linkStyles,
              "group gap-1 data-[state=open]:bg-sunken data-[state=open]:text-text",
              pathname === "/features" && "text-text",
            )}
          >
            Product
            <ChevronDown
              aria-hidden
              className="size-3.5 transition-transform duration-(--duration-base) group-data-[state=open]:rotate-180"
            />
          </NavigationMenu.Trigger>
          <NavigationMenu.Content className="absolute top-full left-0 z-50 pt-2 motion-safe:animate-[gl-drop_160ms_var(--ease-out)]">
            <div className="w-[38rem] rounded-lg border border-line bg-surface p-2 shadow-overlay">
              <ul className="grid grid-cols-2 gap-1">
                {PRODUCT_LINKS.map(({ href, label, text, icon: Icon }) => (
                  <li key={href}>
                    <NavigationMenu.Link asChild>
                      <Link
                        href={href}
                        className="flex gap-3 rounded-md p-3 hover:bg-sunken"
                      >
                        <Icon
                          aria-hidden
                          className="mt-0.5 size-5 shrink-0 text-text"
                        />
                        <span className="flex flex-col gap-0.5">
                          <span className="text-base font-semibold">
                            {label}
                          </span>
                          <span className="text-sm text-text-muted">
                            {text}
                          </span>
                        </span>
                      </Link>
                    </NavigationMenu.Link>
                  </li>
                ))}
              </ul>
              <div className="mt-1 flex items-center justify-between rounded-md bg-sunken px-3 py-2.5 text-sm">
                <span className="text-text-muted">
                  See reports and rules on sample data in the demo.
                </span>
                <Link href="/features" className="font-semibold underline">
                  All features
                </Link>
              </div>
            </div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        {MAIN_LINKS.map(({ href, label }) => (
          <NavigationMenu.Item key={href}>
            <NavigationMenu.Link asChild active={pathname.startsWith(href)}>
              <Link
                href={href}
                className={cn(
                  linkStyles,
                  "data-[active]:bg-sunken data-[active]:text-text",
                )}
              >
                {label}
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>
        ))}

        <NavigationMenu.Item>
          <NavigationMenu.Link asChild>
            <a href={API_REFERENCE_HREF} className={linkStyles}>
              API reference
            </a>
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
