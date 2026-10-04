import type { components } from "@/lib/api/schema";
import type { ColumnInfo } from "./clean-builder";
import { type Draft, draft } from "./steps";

type Metrics = components["schemas"]["MetricsDto"];

const DATE_NAME = /(^|[^a-z])(date|day|when|time)([^a-z]|$)|(_at|_on)$/i;

/** The columns of a finished report, as the builder's pickers list them. */
export function columnsOf(metrics: Metrics): ColumnInfo[] {
  return metrics.columns.map((column) => ({
    name: column.name,
    type: column.inferredType,
    sensitive: column.sensitive ? column.sensitive.kind : null,
  }));
}

/**
 * A first recipe for a file, from what its report found: the steps that fix a problem the report names are switched on, and
 * the ones that change meaning (dates, hiding data, placeholders) are listed but left off, so nothing surprising happens
 * until a person turns it on and has seen what it would do.
 */
export function suggestedSteps(metrics: Metrics): Draft[] {
  const steps: Draft[] = [draft("trim_whitespace")];
  if (metrics.headerIssues.length > 0) steps.push(draft("tidy_headers"));
  if (metrics.emptyRows > 0) steps.push(draft("drop_empty_rows"));
  if (metrics.duplicateRows > 0) steps.push(draft("drop_duplicate_rows"));

  steps.push(draft("replace_values", { on: false }));

  for (const column of metrics.columns) {
    if (column.sensitive) {
      steps.push(draft("mask_column", { on: false, column: column.name }));
    }
  }
  for (const column of metrics.columns) {
    if (column.inferredType === "string" && DATE_NAME.test(column.name)) {
      steps.push(
        draft("standardise_dates", { on: false, column: column.name }),
      );
    }
  }
  return steps;
}
