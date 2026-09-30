import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { stagger } from "@/lib/css-vars";

const ROWS = [
  {
    href: "/compare#spreadsheets",
    name: "Spreadsheet tools",
    text: "Keep editing there. Gridline checks the file before anyone starts.",
  },
  {
    href: "/compare#databases",
    name: "Airtable and Smartsheet",
    text: "Build and run your tables there. Gridline inspects each file that arrives.",
  },
  {
    href: "/compare#quality-tools",
    name: "Data-quality tools",
    text: "They judge the data. Gridline is also where the file is shared, permissioned and versioned.",
  },
  {
    href: "/compare#storage",
    name: "Box and Dropbox",
    text: "They store the file. Gridline stores it and tells you whether it is any good.",
  },
] as const;

/** Where Gridline sits next to the tools people already use, said as jobs rather than rankings. */
export function CompareTeaser() {
  return (
    <section id="compare" className="scroll-mt-16 border-t border-line">
      <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-20">
        <Reveal className="flex flex-col gap-3">
          <h2 className="headline max-w-3xl text-4xl leading-[0.98] sm:text-5xl">
            Keep the tools you have. Add the check.
          </h2>
          <p className="max-w-prose copy text-text-muted">
            Gridline does not replace where you edit or where you build. It sits
            where files arrive.
          </p>
        </Reveal>
        <Reveal delay={100}>
          <ul className="mt-10 border-t border-line-strong">
            {ROWS.map((row, index) => (
              <li
                key={row.href}
                style={stagger(index, 80)}
                className="stagger-item"
              >
                <Link
                  href={row.href}
                  className="group grid items-center gap-x-8 gap-y-1 border-b border-line px-2 py-5 transition-colors duration-(--duration-fast) hover:bg-sunken md:grid-cols-[16rem_1fr_auto]"
                >
                  <span className="text-md font-semibold">{row.name}</span>
                  <span className="text-base text-text-muted">{row.text}</span>
                  <ArrowRight
                    aria-hidden
                    className="hidden size-4 transition-transform duration-(--duration-base) ease-out group-hover:translate-x-1 md:block"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/compare"
            className="link-draw mt-6 inline-block text-base font-medium"
          >
            Read the full comparison
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
