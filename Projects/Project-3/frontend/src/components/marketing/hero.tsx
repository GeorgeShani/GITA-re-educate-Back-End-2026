import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cssVars } from "@/lib/css-vars";
import { DemoButton } from "./demo-button";
import { InspectionDemo } from "./inspection-demo";

const LINES = ["Know what’s in", "a file before", "anyone opens it."] as const;

/** The overview: the manual opened at its first tab. The promise on the left, a file being checked on the right. */
export function Hero() {
  return (
    <section id="overview" className="scroll-mt-16">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div className="flex flex-col gap-7">
          <h1 className="headline text-[3.25rem] leading-[0.92] sm:text-[4.75rem] lg:text-[5rem]">
            {LINES.map((line, index) => {
              const style = cssVars({ "--line-delay": `${index * 110}ms` });
              return (
                <span key={line} className="line-mask">
                  <span className="line-rise" style={style}>
                    {line}
                  </span>
                </span>
              );
            })}
          </h1>
          <p className="copy max-w-xl text-text-muted">
            Gridline checks every CSV and XLSX upload the moment it lands: a
            quality score, any personal data, your own rules, which rows changed
            since the last version, and exactly who can open it. Then it cleans
            the file and answers questions about it.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="primary" size="lg" asChild>
              <Link href="/register">
                Start free
                <ArrowRight
                  aria-hidden
                  className="transition-transform duration-(--duration-base) ease-out group-hover:translate-x-1"
                />
              </Link>
            </Button>
            <DemoButton size="lg" />
          </div>
          <p className="text-sm text-text-subtle">
            The Free plan needs no card. The demo is a read-only company with
            sample files.
          </p>
        </div>
        <div className="lg:justify-self-end">
          <InspectionDemo />
        </div>
      </div>
    </section>
  );
}
