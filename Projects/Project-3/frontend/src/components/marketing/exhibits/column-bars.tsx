import { Stamp } from "@/components/ui/stamp";
import { cn } from "@/lib/cn";
import { cssVars, stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";

const COLUMNS = [
  { name: "sku", type: "text", empty: 0 },
  { name: "name", type: "text", empty: 1.2 },
  { name: "qty", type: "whole number", empty: 0 },
  { name: "unit_cost", type: "number", empty: 12.8 },
  { name: "region", type: "text", empty: 3.1 },
  { name: "supplier", type: "text", empty: 0.9 },
] as const;

const SCALE = 20; // the bar's full width stands for 20% empty
const LIMIT = 5;

/** Empty cells per column, with the company's limit marked: the report the way a person reads it. */
export function ColumnBars() {
  return (
    <Panel label="Empty cells per column · inventory-q2.csv (sample)">
      <ul className="flex flex-col">
        {COLUMNS.map((column, index) => {
          const over = column.empty > LIMIT;
          return (
            <li
              key={column.name}
              style={stagger(index, 70)}
              className="stagger-item grid grid-cols-[6rem_minmax(0,1fr)_7.75rem] items-center gap-3 border-b border-line py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-sm">{column.name}</p>
                <p className="text-xs text-text-subtle">{column.type}</p>
              </div>
              <div className="relative h-2.5 rounded-xs bg-sunken">
                <div
                  className={cn(
                    "fill h-full rounded-xs",
                    over ? "bg-hold" : "bg-text",
                  )}
                  style={cssVars(
                    { "--fill-delay": `${index * 70 + 150}ms` },
                    {
                      width: `${Math.max((column.empty / SCALE) * 100, column.empty > 0 ? 2 : 0)}%`,
                    },
                  )}
                />
                <span
                  aria-hidden
                  className="absolute -top-1 -bottom-1 w-px bg-text-subtle"
                  style={{ left: `${(LIMIT / SCALE) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <span
                  className={cn(
                    "num font-mono text-sm",
                    over && "font-semibold text-hold",
                  )}
                >
                  {column.empty.toFixed(1)}%
                </span>
                {over ? <Stamp tone="hold">Over</Stamp> : null}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-text-subtle">
        The tick marks a 5% limit. Sample data, invented for this page.
      </p>
    </Panel>
  );
}
