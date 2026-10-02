import Link from "next/link";
import { Blocks } from "@/components/docs/blocks";
import { Prose } from "@/components/docs/prose";
import { DOC_SECTIONS, hrefOf } from "@/lib/docs/registry";
import { OVERVIEW } from "./start";

/** The docs front page: what Gridline is, then every section of the manual and what is in it, so the whole shape is visible at once. */
export function DocsHome() {
  return (
    <div className="flex flex-col gap-10">
      <Prose>
        <Blocks blocks={OVERVIEW} />
      </Prose>
      <section aria-labelledby="all-guides" className="flex flex-col gap-4">
        <h2
          id="all-guides"
          className="border-t border-line pt-6 text-2xl font-extrabold"
        >
          Every guide
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {DOC_SECTIONS.filter((section) => section.title !== "Start here").map(
            (section) => (
              <section
                key={section.title}
                className="leaf flex flex-col gap-3 p-5"
              >
                <h3 className="text-lg font-bold">{section.title}</h3>
                <ul className="flex flex-col gap-2">
                  {section.pages.map((page) => (
                    <li key={page.slug}>
                      <Link href={hrefOf(page)} className="group block">
                        <span className="font-semibold underline-offset-2 group-hover:underline">
                          {page.title}
                        </span>
                        <span className="block text-sm text-text-muted">
                          {page.summary}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
