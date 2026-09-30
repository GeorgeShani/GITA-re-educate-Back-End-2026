import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-text-muted">
        <Logo markClassName="size-6" className="text-text" />
        <nav aria-label="Footer" className="flex gap-5">
          <Link href="/pricing">Pricing</Link>
          <Link href="/security">Security</Link>
          <Link href="/docs">Docs</Link>
        </nav>
      </div>
    </footer>
  );
}
