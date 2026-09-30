import Link from "next/link";
import { Barcode } from "@/components/brand/barcode";
import { Logo } from "@/components/brand/logo";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { Stamp } from "@/components/ui/stamp";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { DemoButton } from "./demo-button";
import { FOOTER_COLUMNS } from "./nav-data";

const linkStyles = "text-base hover:underline";

/**
 * The public site's footer: the crate board the whole site is packed on. A closing statement and both ways in on the
 * left, a pallet label on the right, the site map in ruled columns, and a dark bottom bar.
 */
export function SiteFooter() {
  return (
    <footer className="cover bg-cover text-on-cover">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 pt-16 pb-14 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="flex max-w-2xl flex-col gap-6">
          <p className="headline text-4xl leading-[0.95] text-balance sm:text-5xl">
            Every spreadsheet, checked in.
          </p>
          <p className="max-w-prose copy text-on-cover-muted">
            Upload a file and know in seconds whether it is any good, what
            changed since the last version, and exactly who can open it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="onCover" size="lg" asChild>
              <Link href="/register">Start free</Link>
            </Button>
            <DemoButton variant="onCoverOutline" size="lg" />
          </div>
        </div>

        <Reveal className="lg:justify-self-end">
          <figure
            aria-label="A sample inspection tag"
            className="tag-swing flex w-full max-w-xs flex-col gap-4 rounded-md border-2 border-on-cover bg-tag p-5 text-on-tag lg:w-72"
          >
            <div className="flex items-center justify-between">
              <span className="width-display text-lg font-extrabold">
                Gridline
              </span>
              <Stamp tone="pass" className="bg-surface">
                Passed
              </Stamp>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-on-tag/70">File</dt>
              <dd className="num font-mono">payroll-march.csv</dd>
              <dt className="text-on-tag/70">Rows</dt>
              <dd className="num font-mono">1,204</dd>
              <dt className="text-on-tag/70">Rules</dt>
              <dd className="num font-mono">5 of 5</dd>
              <dt className="text-on-tag/70">Access</dt>
              <dd>2 people</dd>
            </dl>
            <Barcode value="GRIDLINE-INSPECTED" className="h-9 w-full" />
            <figcaption className="text-xs text-on-tag/70">
              Illustration. A real tag carries your file's own results.
            </figcaption>
          </figure>
        </Reveal>
      </div>

      <div className="border-t border-on-cover/25">
        <nav
          aria-label="Footer"
          className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-6 py-12 md:grid-cols-4"
        >
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-on-cover-muted">
                {column.title}
              </h2>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {"plain" in link ? (
                      <a href={link.href} className={linkStyles}>
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={linkStyles}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-on-cover/25">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 text-sm text-on-cover-muted">
          <div className="flex items-center gap-3">
            <Logo markClassName="size-6" className="text-on-cover" />
            <span>© {new Date().getFullYear()} Gridline</span>
          </div>
          <p className="max-w-md">
            Files are stored privately and served by short-lived links.
          </p>
          <ThemeToggle className="text-on-cover-muted hover:bg-on-cover/10 hover:text-on-cover" />
        </div>
      </div>
    </footer>
  );
}
