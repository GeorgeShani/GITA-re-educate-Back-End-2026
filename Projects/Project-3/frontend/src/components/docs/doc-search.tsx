"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { API_REFERENCE_HREF } from "@/components/marketing/nav-data";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { allDocs, hrefOf, sectionOf } from "@/lib/docs/registry";

/** Every word the person typed must appear in a guide's title, section or summary. */
function matches(query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return allDocs().filter((page) => {
    const haystack =
      `${page.title} ${sectionOf(page)?.title ?? ""} ${page.summary}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * Find a guide by what it is about. Opens from the button, from `/`, or from Ctrl/Cmd+K; arrow keys move, Enter goes.
 * It searches the guides' titles and summaries (there is no full-text index), which is what a reader scans for.
 */
export function DocSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = matches(query);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName));
      if (
        (event.key === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (index: number) => {
    const page = results[index];
    if (!page) return;
    setOpen(false);
    router.push(hrefOf(page));
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setQuery("");
          setActive(0);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <Button
          variant="secondary"
          className="w-9 justify-center px-0 text-text-muted sm:w-64 sm:justify-start sm:px-3"
          aria-label="Search the documentation"
        >
          <Search aria-hidden />
          <span className="hidden flex-1 text-left sm:inline">
            Search guides
          </span>
          <kbd className="hidden rounded-xs border border-line-strong px-1.5 font-mono text-xs sm:inline">
            /
          </kbd>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-text/40 motion-safe:animate-[gl-fade_160ms_var(--ease-out)]" />
        <Dialog.Content
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-line-strong bg-surface shadow-overlay motion-safe:animate-[gl-drop_160ms_var(--ease-out)]"
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">
            Search the documentation
          </Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-line px-3.5">
            <Search aria-hidden className="size-4 shrink-0 text-text-muted" />
            <input
              // biome-ignore lint/a11y/noAutofocus: the dialog exists to be typed into
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((index) => Math.min(index + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) => Math.max(index - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(active);
                }
              }}
              placeholder="What do you want to do?"
              aria-label="Search guides"
              className="h-12 w-full bg-transparent text-md outline-none placeholder:text-text-subtle"
            />
          </div>
          <ul className="overflow-y-auto p-1.5" aria-label="Guides">
            {results.map((page, index) => (
              <li key={page.slug}>
                <button
                  type="button"
                  onClick={() => go(index)}
                  onMouseMove={() => setActive(index)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left",
                    index === active && "bg-sunken",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{page.title}</span>
                    <span className="block truncate text-sm text-text-muted">
                      {sectionOf(page)?.title} · {page.summary}
                    </span>
                  </span>
                  {index === active ? (
                    <CornerDownLeft
                      aria-hidden
                      className="size-4 shrink-0 text-text-muted"
                    />
                  ) : null}
                </button>
              </li>
            ))}
            {results.length === 0 ? (
              <li className="px-3 py-8 text-center text-text-muted">
                No guide matches “{query}”. The{" "}
                <a
                  href={API_REFERENCE_HREF}
                  className="font-semibold underline underline-offset-2"
                >
                  API reference
                </a>{" "}
                lists every endpoint.
              </li>
            ) : null}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
