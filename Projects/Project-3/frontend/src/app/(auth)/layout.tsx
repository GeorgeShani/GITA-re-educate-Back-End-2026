import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Stamp } from "@/components/ui/stamp";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Sign-in, registration, activation, invitations and password reset. At wide widths the back cover of the manual stands
 * beside the form (the same dark cover the site's footer uses), with the one promise the product makes; on a phone it is
 * only the form.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="cover hidden flex-col justify-between bg-cover p-12 text-on-cover lg:flex">
        <Link href="/" aria-label="Gridline home" className="self-start">
          <Logo className="text-on-cover" />
        </Link>

        <div className="flex max-w-md flex-col gap-8">
          <h2 className="headline text-5xl leading-[0.95]">
            Checked on arrival. Trusted after.
          </h2>
          <p className="copy text-on-cover-muted">
            Every spreadsheet your company keeps is inspected the moment it
            lands, so nobody builds on a file that was already broken.
          </p>
          <div className="tag-swing flex w-full max-w-xs flex-col gap-3 rounded-md border-2 border-on-cover bg-tag p-4 text-on-tag">
            <p className="font-mono text-xs">inventory-q2.csv · sample</p>
            <div className="flex flex-wrap gap-1.5">
              <Stamp tone="pass">5 passed</Stamp>
              <Stamp tone="caution">1 warning</Stamp>
              <Stamp tone="hold">2 held</Stamp>
            </div>
            <p className="text-sm font-medium">Score 62 · needs attention</p>
          </div>
        </div>

        <p className="text-sm text-on-cover-muted">
          Per-company data. Per-person access. Every change on the record.
        </p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between px-6 py-4">
          <Link href="/" aria-label="Gridline home" className="lg:hidden">
            <Logo />
          </Link>
          <Link
            href="/"
            className="link-draw hidden items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text lg:inline-flex"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to the site
          </Link>
          <ThemeToggle />
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-7 px-6 pt-4 pb-14">
          {children}
        </main>
      </div>
    </div>
  );
}
