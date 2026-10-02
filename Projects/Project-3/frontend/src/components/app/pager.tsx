import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Previous / next for a numbered list. `href` builds the address of a page, so each page keeps its own filters. */
export function Pager({
  label,
  page,
  totalPages,
  href,
}: {
  label: string;
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <Button asChild size="sm" aria-disabled={page <= 1}>
        <Link href={href(Math.max(1, page - 1))}>
          <ArrowLeft aria-hidden />
          Previous
        </Link>
      </Button>
      <p className="text-sm text-text-muted">
        Page <span className="num font-mono">{page}</span> of{" "}
        <span className="num font-mono">{totalPages}</span>
      </p>
      <Button asChild size="sm" aria-disabled={page >= totalPages}>
        <Link href={href(Math.min(totalPages, page + 1))}>
          Next
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </nav>
  );
}
