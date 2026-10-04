import { Stamp } from "@/components/ui/stamp";
import { stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";

const COUNTS = [
  ["Added", "120"],
  ["Removed", "3"],
  ["Changed", "57"],
  ["Unchanged", "9,232"],
] as const;

/** Version 3 against version 4, row by row: counts, and three of the changes with the old value struck through. Invented sample. */
export function RowChanges() {
  return (
    <Panel label="inventory-q2.csv · version 3 to 4, by sku (sample)">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {COUNTS.map(([label, value], index) => (
          <div
            key={label}
            style={stagger(index, 80)}
            className="stagger-item flex flex-col gap-0.5 rounded-md border border-line p-2.5"
          >
            <dt className="text-xs text-text-subtle">{label}</dt>
            <dd className="num font-mono text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-col text-sm">
        <li className="flex flex-col gap-1 border-b border-line py-3">
          <span className="flex items-center gap-2">
            <Stamp tone="caution">changed</Stamp>
            <span className="font-mono text-xs">sku BX-1041</span>
          </span>
          <span className="font-mono text-xs">
            unit_cost <del className="text-text-subtle">4.80</del>{" "}
            <strong>5.25</strong>
          </span>
        </li>
        <li className="flex flex-col gap-1 border-b border-line py-3">
          <span className="flex items-center gap-2">
            <Stamp tone="pass">added</Stamp>
            <span className="font-mono text-xs">sku BX-2210</span>
          </span>
          <span className="font-mono text-xs text-text-muted">
            qty 400 · unit_cost 12.10
          </span>
        </li>
        <li className="flex flex-col gap-1 py-3">
          <span className="flex items-center gap-2">
            <Stamp tone="hold">removed</Stamp>
            <span className="font-mono text-xs">sku BX-0007</span>
          </span>
          <span className="font-mono text-xs text-text-muted">
            <del>qty 12 · unit_cost 3.40</del>
          </span>
        </li>
      </ul>
      <p className="text-xs text-text-subtle">
        Rows are lined up by the columns you choose. The first 500 changes are
        browsable and a CSV has every one. Sample data, invented for this page.
      </p>
    </Panel>
  );
}
