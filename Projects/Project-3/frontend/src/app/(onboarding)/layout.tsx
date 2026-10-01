import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/** First-run screens for someone signed in who cannot use the dashboard yet: a plain page with a way out. */
export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Link href="/" aria-label="Gridline home">
          <Logo />
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <form action="/session/logout" method="post">
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-6 py-12">
        {children}
      </main>
    </div>
  );
}
