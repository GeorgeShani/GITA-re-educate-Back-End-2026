import type { components } from "@/lib/api/schema";
import { cn } from "@/lib/cn";
import { COLUMN_TYPE_LABEL, count } from "./labels";

type Preview = components["schemas"]["PreviewDto"];

/** A cell as it should read: nothing for an empty one, "yes"/"no" for a flag, and numbers as they came. */
function show(cell: string | number | boolean | null): string {
  if (cell === null) return "";
  if (typeof cell === "boolean") return cell ? "yes" : "no";
  return String(cell);
}

/** The first rows of the file, so a person can see it is the one they meant before reading its report. */
export function PreviewPanel({ preview }: { preview: Preview | null }) {
  if (!preview) {
    return (
      <p className="max-w-prose text-text-muted">
        There is no preview yet. It appears once the file has been checked, and
        some files cannot be previewed at all.
      </p>
    );
  }
  const numeric = preview.columns.map(
    (column) =>
      column.inferredType === "integer" || column.inferredType === "number",
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-text-muted">
        Showing the first{" "}
        <span className="num font-mono">{count(preview.rows.length)}</span> of{" "}
        <span className="num font-mono">{count(preview.totalRows)}</span> rows
        {preview.truncated ? " (the file is longer than Gridline reads)" : ""}.
      </p>
      <div className="leaf max-h-[34rem] overflow-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">The first rows of the file</caption>
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-line-strong">
              <th
                scope="col"
                className="px-3 py-2 text-right text-xs font-semibold text-text-subtle"
              >
                <span className="sr-only">Row</span>
              </th>
              {preview.columns.map((column, index) => (
                <th
                  key={`${column.name}-${index.toString()}`}
                  scope="col"
                  className={cn(
                    "min-w-28 px-3 py-2",
                    numeric[index] && "text-right",
                  )}
                >
                  <span
                    className="block max-w-56 truncate font-semibold"
                    title={column.name}
                  >
                    {column.name || "(no name)"}
                  </span>
                  <span className="block text-xs font-normal text-text-subtle">
                    {COLUMN_TYPE_LABEL[column.inferredType]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr
                // A row has no identity beyond its place in the file.
                key={rowIndex.toString()}
                className="border-b border-line last:border-b-0 even:bg-sunken/50"
              >
                <th
                  scope="row"
                  className="num px-3 py-1.5 text-right font-mono text-xs font-normal text-text-subtle"
                >
                  {rowIndex + 1}
                </th>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex.toString()}
                    className={cn(
                      "max-w-72 truncate px-3 py-1.5 text-sm",
                      numeric[cellIndex] && "num text-right font-mono",
                    )}
                    title={show(cell)}
                  >
                    {show(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
