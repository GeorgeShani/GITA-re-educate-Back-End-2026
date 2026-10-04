import { stagger } from "@/lib/css-vars";
import { Panel } from "../exhibit";

const BARS = [
  ["North", 412_600, 100],
  ["South", 298_150, 72],
  ["East", 187_900, 46],
  ["West", 96_400, 23],
] as const;

const CHIPS = ["Total of revenue", "Group by region", "Highest first"] as const;

/** A question in words, the query the assistant chose (as chips anyone can edit), and the answer. Invented sample. */
export function AskResult() {
  return (
    <Panel label="sales-2026.csv · ask (sample)">
      <p className="rounded-md border border-line-strong bg-sunken px-3 py-2 text-sm">
        Total revenue by region, highest first
      </p>
      <ul aria-label="The query it chose" className="flex flex-wrap gap-2">
        {CHIPS.map((chip) => (
          <li
            key={chip}
            className="rounded-md border border-line-strong bg-surface px-2.5 py-1 text-xs font-semibold"
          >
            {chip}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-2.5">
        {BARS.map(([region, value, width], index) => (
          <li
            key={region}
            style={stagger(index, 90)}
            className="stagger-item grid grid-cols-[4rem_1fr_5rem] items-center gap-3 text-sm"
          >
            <span>{region}</span>
            <span
              aria-hidden
              className="h-3.5 rounded-xs"
              style={{ width: `${width}%`, background: "var(--color-chart-1)" }}
            />
            <span className="num text-right font-mono text-xs">
              {value.toLocaleString("en-US")}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-text-subtle">
        The assistant saw the question and the column names, never a row.
        Gridline ran the query on every row. Sample data, invented for this
        page.
      </p>
    </Panel>
  );
}
