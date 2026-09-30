import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DemoButton } from "./demo-button";
import { DesktopNav } from "./desktop-nav";
import { MobileMenu } from "./mobile-menu";

/** The public site's header: sticky, ruled, and always carrying both ways in (the demo and a free company). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-6">
        <Link
          href="/"
          aria-label="Gridline home"
          className="mr-2 rounded-md py-1"
        >
          <Logo />
        </Link>

        <DesktopNav />

        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Button variant="ghost" className="hidden sm:inline-flex" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <div className="hidden sm:block">
            <DemoButton />
          </div>
          <Button variant="primary" asChild>
            <Link href="/register">Start free</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
