import { notFound } from "next/navigation";
import { OnThisPage } from "@/components/docs/on-this-page";
import { Pager } from "@/components/docs/pager";
import { Prose } from "@/components/docs/prose";
import { API_REFERENCE_HREF } from "@/components/marketing/nav-data";
import { DOC_BODIES } from "@/lib/docs/content";
import { allDocs, findDoc, neighbours, sectionOf } from "@/lib/docs/registry";

const ARTICLE_ID = "doc-article";

export function generateStaticParams() {
  return allDocs().map((page) => ({
    slug: page.slug ? page.slug.split("/") : [],
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/docs/[[...slug]]">) {
  const page = findDoc((await params).slug);
  return { title: page ? page.title : "Docs", description: page?.summary };
}

export default async function Page({ params }: PageProps<"/docs/[[...slug]]">) {
  const page = findDoc((await params).slug);
  if (!page) notFound();

  const body = DOC_BODIES[page.slug];
  const { previous, next } = neighbours(page);

  return (
    <div className="grid gap-10 px-4 py-8 sm:px-8 sm:py-12 xl:grid-cols-[minmax(0,1fr)_14rem]">
      <article
        id={ARTICLE_ID}
        className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-8"
      >
        <header className="flex flex-col gap-4">
          <p className="text-sm font-semibold tracking-[0.06em] text-text-muted uppercase">
            {sectionOf(page)?.title}
          </p>
          <h1 className="headline text-4xl leading-[0.98] sm:text-5xl">
            {page.title}
          </h1>
          <p className="copy text-text-muted">{page.summary}</p>
        </header>

        {body ? (
          page.slug === "" ? (
            body()
          ) : (
            <Prose>{body()}</Prose>
          )
        ) : (
          <div className="leaf flex flex-col gap-2 p-5">
            <p className="font-semibold">This guide is still being written.</p>
            <p className="text-text-muted">
              The summary above is what it will cover. Until then the{" "}
              <a
                href={API_REFERENCE_HREF}
                className="font-semibold text-text underline underline-offset-2"
              >
                API reference
              </a>{" "}
              documents every endpoint involved, with its parameters and
              responses.
            </p>
          </div>
        )}

        <Pager previous={previous} next={next} />
      </article>

      <aside className="hidden xl:block">
        <div className="sticky top-20">
          <OnThisPage articleId={ARTICLE_ID} />
        </div>
      </aside>
    </div>
  );
}
