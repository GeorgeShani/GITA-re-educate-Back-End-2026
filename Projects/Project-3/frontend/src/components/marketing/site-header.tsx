import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/security", label: "Security" },
  { href: "/docs", label: "Docs" },
] as const;

export function SiteHeader() {
  return (
    <header className="ruled">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-8 px-6">
        <Link href="/" aria-label="Gridline home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden gap-6 text-base md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-text-muted hover:text-text"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="primary" asChild>
            <Link href="/register">Start free</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
