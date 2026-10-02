"use client";

import { useId, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/marketing/exhibits/copy-button";
import { cn } from "@/lib/cn";

const KEY = "gl-docs-language";

/** The language a reader last chose, shared by every sample on every page (and remembered between visits). */
const listeners = new Set<() => void>();
let chosen: string | null = null;

function read(): string | null {
  if (chosen !== null) return chosen;
  try {
    chosen = window.localStorage.getItem(KEY);
  } catch {
    chosen = null;
  }
  return chosen;
}

function choose(label: string): void {
  chosen = label;
  try {
    window.localStorage.setItem(KEY, label);
  } catch {
    // Remembering is a convenience; the choice still holds for this visit.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The same call in more than one language, one click apart. A reader who picked JavaScript wants JavaScript everywhere,
 * so the choice is shared by every sample, not made again per block.
 */
export function CodeTabs({
  tabs,
}: {
  tabs: readonly { label: string; code: string }[];
}) {
  const id = useId();
  const label = useSyncExternalStore(subscribe, read, () => null);
  const selected = Math.max(
    0,
    tabs.findIndex((tab) => tab.label === label),
  );
  const current = tabs[selected];
  if (!current) return null;

  return (
    <figure className="leaf overflow-hidden">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line bg-sunken pr-1 pl-1">
        <div role="tablist" aria-label="Language" className="flex">
          {tabs.map((tab, index) => (
            <button
              key={tab.label}
              id={`${id}-${index}`}
              type="button"
              role="tab"
              aria-selected={index === selected}
              aria-controls={`${id}-panel`}
              onClick={() => choose(tab.label)}
              className={cn(
                "h-9 border-b-2 px-3 text-sm font-medium",
                index === selected
                  ? "border-text text-text"
                  : "border-transparent text-text-muted hover:text-text",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <CopyButton
          text={current.code}
          label={`Copy the ${current.label} sample`}
        />
      </figcaption>
      <pre
        id={`${id}-panel`}
        role="tabpanel"
        aria-labelledby={`${id}-${selected}`}
        className="overflow-x-auto p-4 font-mono text-sm leading-relaxed"
      >
        <code>{current.code}</code>
      </pre>
    </figure>
  );
}
