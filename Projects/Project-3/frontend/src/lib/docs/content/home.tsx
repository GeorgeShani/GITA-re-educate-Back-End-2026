import Link from "next/link";
import { API_REFERENCE_HREF } from "@/components/marketing/nav-data";
import { DOC_SECTIONS, hrefOf } from "@/lib/docs/registry";

/** The docs front page: every section of the manual and what is in it, so a reader can see the whole shape at once. */
export function DocsHome() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-4 sm:grid-cols-2">
        {DOC_SECTIONS.filter((section) => section.title !== "Start here").map(
          (section) => (
            <section
              key={section.title}
              className="leaf flex flex-col gap-3 p-5"
            >
              <h2 className="text-lg font-bold">{section.title}</h2>
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
      <p className="text-text-muted">
        Looking for an endpoint? The{" "}
        <a
          href={API_REFERENCE_HREF}
          className="font-semibold text-text underline underline-offset-2"
        >
          API reference
        </a>{" "}
        lists every one, with its parameters and responses, and is generated
        from the code so it cannot drift.
      </p>
    </div>
  );
}
