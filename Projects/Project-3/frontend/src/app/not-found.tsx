import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

/**
 * Anything with no page behind it, and every `notFound()` the app raises (a file, an invoice or an audit entry you cannot
 * see is "not found" on purpose: Gridline does not say whether it exists).
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
      <p className="num font-mono text-sm text-text-subtle">404</p>
      <h1 className="headline text-5xl leading-[0.98]">
        There is nothing here
      </h1>
      <p className="copy text-text-muted">
        The page may have moved, the address may have a typo, or it may be
        something you do not have access to. Gridline does not say which.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" asChild>
          <Link href="/">Go to the home page</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/dashboard">Open the dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
