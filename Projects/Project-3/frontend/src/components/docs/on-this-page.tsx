"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * "On this page": the headings of the open guide, with the one being read marked. It reads them from the rendered
 * article (`h2` and `h3` that carry an id), so any guide gets one without declaring its outline twice.
 */
export function OnThisPage({ articleId }: { articleId: string }) {
  const pathname = usePathname();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [current, setCurrent] = useState<string | null>(null);

  // `pathname` is not read inside the effect, but it is WHEN to read again: a client-side navigation swaps the article.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    const article = document.getElementById(articleId);
    if (!article) return;
    const found: Heading[] = [];
    for (const element of article.querySelectorAll("h2[id], h3[id]")) {
      found.push({
        id: element.id,
        text: element.textContent ?? "",
        level: element.tagName === "H2" ? 2 : 3,
      });
    }
    setHeadings(found);
    setCurrent(found[0]?.id ?? null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setCurrent(visible.target.id);
      },
      { rootMargin: "-72px 0px -70% 0px" },
    );
    for (const heading of found) {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [articleId, pathname]);

  if (headings.length < 2) return null;
  return (
    <nav aria-label="On this page" className="flex flex-col gap-2">
      <p className="text-xs font-semibold tracking-[0.06em] text-text-subtle uppercase">
        On this page
      </p>
      <ul className="flex flex-col border-l border-line">
        {headings.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              aria-current={current === heading.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-1 text-sm text-text-muted transition-colors duration-(--duration-fast) hover:text-text",
                heading.level === 3 ? "pl-6" : "pl-3",
                current === heading.id
                  ? "border-text font-semibold text-text"
                  : "border-transparent",
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
