import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { DocNav } from "@/components/docs/doc-nav";
import { DocSearch } from "@/components/docs/doc-search";
import { DocsMobileNav } from "@/components/docs/docs-mobile-nav";
import { API_REFERENCE_HREF } from "@/components/marketing/nav-data";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * The documentation's own frame, apart from the marketing site and the application: a header with search, a table of
 * contents down the left (a drawer on a phone), and room for the guide and its "on this page" outline. It reads no
 * session, so every guide is a static page.
 */
export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas">
        <div className="mx-auto flex h-14 w-full max-w-[88rem] items-center gap-2 px-3 sm:gap-3 sm:px-5">
          <DocsMobileNav />
          <Link
            href="/"
            aria-label="Gridline home"
            className="flex items-center rounded-md py-1"
          >
            <Logo />
          </Link>
          <Link
            href="/docs"
            className="headline hidden rounded-xs border border-text px-2 py-0.5 text-sm sm:inline-block"
          >
            Docs
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            <DocSearch />
            <Button variant="ghost" className="hidden md:inline-flex" asChild>
              <a href={API_REFERENCE_HREF}>API reference</a>
            </Button>
            <ThemeToggle />
            <Button variant="primary" className="hidden sm:inline-flex" asChild>
              <Link href="/dashboard">Open the app</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[88rem] flex-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="scrollbar-none sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto border-r border-line py-6 pr-3 pl-5 lg:block">
          <DocNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
