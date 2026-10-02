import type { ReactNode } from "react";

/** A titled leaf for one chart: heading and what it shows above, the chart in a fixed-height well, a table view below. */
export function ChartCard({
  title,
  summary,
  legend,
  children,
  table,
}: {
  title: string;
  /** One sentence that says what the chart shows, and what to take from it. */
  summary: ReactNode;
  legend?: ReactNode;
  children: ReactNode;
  /** The same numbers as a table, for anyone who cannot or would rather not read a chart. */
  table: ReactNode;
}) {
  return (
    <section className="leaf flex flex-col gap-4 p-5">
      <header className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-text-muted">{summary}</p>
        {legend ? (
          <ul
            aria-label="Legend"
            className="mt-1 flex flex-wrap gap-x-5 gap-y-1"
          >
            {legend}
          </ul>
        ) : null}
      </header>
      {children}
      <details className="group">
        <summary className="w-fit cursor-pointer text-sm font-semibold text-text-muted underline-offset-2 hover:text-text hover:underline">
          Show as a table
        </summary>
        <div className="mt-3 max-h-72 overflow-auto rounded-md border border-line">
          {table}
        </div>
      </details>
    </section>
  );
}

/** One legend entry: a short stroke of the series' colour, then its name in text ink. */
export function LegendKey({ swatch, name }: { swatch: string; name: string }) {
  return (
    <li className="flex items-center gap-2 text-sm text-text-muted">
      <span
        aria-hidden
        className="h-0.5 w-4 rounded-full"
        style={{ background: swatch }}
      />
      {name}
    </li>
  );
}

/** A small data table in the product's style: used for every chart's "Show as a table". */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}) {
  return (
    <table className="w-full border-collapse text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 bg-sunken text-text-muted">
        <tr>
          {columns.map((column, index) => (
            <th
              key={column}
              scope="col"
              className={`px-3 py-2 font-semibold ${index > 0 ? "text-right" : ""}`}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((row) => (
          <tr key={row[0]}>
            {row.map((cell, index) => (
              <td
                key={`${row[0]}-${columns[index]}`}
                className={`px-3 py-1.5 ${index > 0 ? "num text-right" : ""}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
