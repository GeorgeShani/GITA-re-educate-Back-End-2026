import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { type DocPage, hrefOf } from "@/lib/docs/registry";

/** The guides either side of this one, so the manual can be read straight through. */
export function Pager({
  previous,
  next,
}: {
  previous: DocPage | undefined;
  next: DocPage | undefined;
}) {
  return (
    <nav
      aria-label="Previous and next guide"
      className="grid gap-3 border-t border-line pt-8 sm:grid-cols-2"
    >
      {previous ? (
        <Link
          href={hrefOf(previous)}
          className="leaf flex flex-col gap-1 p-4 hover:bg-sunken"
        >
          <span className="flex items-center gap-1.5 text-sm text-text-muted">
            <ArrowLeft aria-hidden className="size-3.5" />
            Previous
          </span>
          <span className="font-semibold">{previous.title}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={hrefOf(next)}
          className="leaf flex flex-col items-end gap-1 p-4 text-right hover:bg-sunken"
        >
          <span className="flex items-center gap-1.5 text-sm text-text-muted">
            Next
            <ArrowRight aria-hidden className="size-3.5" />
          </span>
          <span className="font-semibold">{next.title}</span>
        </Link>
      ) : null}
    </nav>
  );
}
