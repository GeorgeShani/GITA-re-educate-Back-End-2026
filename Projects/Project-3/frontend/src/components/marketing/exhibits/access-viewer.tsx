"use client";

import { FileSpreadsheet, Lock } from "lucide-react";
import { useState } from "react";
import { Stamp } from "@/components/ui/stamp";
import { cn } from "@/lib/cn";
import { stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";

interface Viewer {
  id: string;
  name: string;
  relation: string;
  named: boolean;
}

const VIEWERS: Viewer[] = [
  { id: "priya", name: "Priya", relation: "uploaded it", named: true },
  { id: "sam", name: "Sam", relation: "is named on it", named: true },
  { id: "lena", name: "Lena", relation: "is not named", named: false },
];

const FILES = [
  { name: "price-list.csv", restricted: false },
  { name: "payroll-march.csv", restricted: true },
  { name: "q2-targets.csv", restricted: false },
] as const;

/** Switch between three people and watch a restricted file appear and disappear: invisible, not forbidden. */
export function AccessViewer() {
  const [viewerId, setViewerId] = useState("priya");
  const viewer =
    VIEWERS.find((candidate) => candidate.id === viewerId) ?? VIEWERS[0];
  if (!viewer) return null;
  const visible = FILES.filter((file) => !file.restricted || viewer.named);

  return (
    <Panel label="Who sees what">
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Viewing as</legend>
        {VIEWERS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={option.id === viewer.id}
            onClick={() => setViewerId(option.id)}
            className={cn(
              "h-8 rounded-sm border px-3 text-sm transition-colors duration-(--duration-fast)",
              option.id === viewer.id
                ? "border-text bg-text text-canvas"
                : "border-line-strong text-text-muted hover:bg-sunken hover:text-text",
            )}
          >
            {option.name}
          </button>
        ))}
      </fieldset>

      <ul key={viewer.id} className="flex min-h-36 flex-col">
        {visible.map((file, index) => (
          <li
            key={file.name}
            style={stagger(index, 80)}
            className="conveyor flex items-center justify-between gap-3 border-b border-line py-2.5 text-sm last:border-b-0"
          >
            <span className="flex min-w-0 items-center gap-2">
              <FileSpreadsheet
                aria-hidden
                className="size-4 shrink-0 text-text-subtle"
              />
              <span className="truncate font-mono">{file.name}</span>
            </span>
            {file.restricted ? (
              <Stamp tone="idle" icon={<Lock aria-hidden />}>
                Restricted
              </Stamp>
            ) : (
              <span className="text-xs text-text-subtle">Whole company</span>
            )}
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="text-sm text-text-muted">
        {viewer.named ? (
          <>
            {viewer.name} {viewer.relation}, so the restricted file is in the
            list above.
          </>
        ) : (
          <>
            {viewer.name} {viewer.relation}. If {viewer.name} opens the
            file&rsquo;s link, the answer is{" "}
            <span className="font-mono text-text">404 Not found</span>: nothing
            shows that it exists.
          </>
        )}
      </p>
    </Panel>
  );
}
