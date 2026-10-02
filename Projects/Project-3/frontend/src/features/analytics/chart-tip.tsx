"use client";

import { isRecord } from "@/lib/guards";

export const AXIS_TICK = {
  fill: "var(--color-text-subtle)",
  fontSize: 12,
};

export const GRID = "var(--color-line)";
export const BASELINE = "var(--color-line-strong)";

/** The one the hover layer reads from a Recharts tooltip payload: the number under `key` in the hovered datum, if any. */
export function readValue(payload: unknown, key: string): number | null {
  if (!Array.isArray(payload)) return null;
  for (const item of payload) {
    if (!isRecord(item)) continue;
    const datum = item.payload;
    if (isRecord(datum)) {
      const value = datum[key];
      if (typeof value === "number") return value;
    }
  }
  return null;
}

/** The label (the x value) of the hovered point, when it is text. */
export function readLabel(label: unknown): string {
  return typeof label === "string" || typeof label === "number"
    ? String(label)
    : "";
}

export interface TipRow {
  name: string;
  value: string;
  /** The series colour as a CSS variable, drawn as a short stroke: identity comes from the key, never from coloured text. */
  swatch: string;
}

/**
 * The hover readout, set like the rest of the product: a hairline-ruled leaf, the value first and in the strongest ink, the
 * series name second, and a short line of the series' colour as the key. Text stays in text tokens.
 */
export function TipBox({
  title,
  rows,
}: {
  title: string;
  rows: readonly TipRow[];
}) {
  return (
    <div className="min-w-36 rounded-md border border-line-strong bg-surface p-3 shadow-overlay">
      <p className="mb-1.5 text-sm font-semibold text-text">{title}</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-0.5 w-3.5 shrink-0 rounded-full"
              style={{ background: row.swatch }}
            />
            <span className="num font-semibold text-text">{row.value}</span>
            <span className="text-text-muted">{row.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
