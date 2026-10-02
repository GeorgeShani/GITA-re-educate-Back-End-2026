import type { components } from "@/lib/api/schema";

export type ColumnType =
  components["schemas"]["ColumnMetricsDto"]["inferredType"];

/** What a column holds, in words a person would use. */
export const COLUMN_TYPE_LABEL: Record<ColumnType, string> = {
  integer: "Whole numbers",
  number: "Numbers",
  boolean: "Yes / no",
  date: "Dates",
  string: "Text",
  empty: "Empty",
};

export function percent(value: number): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

export function count(value: number): string {
  return value.toLocaleString("en-US");
}

/** A number from a column's statistics: whole when it is whole, otherwise to two places. */
export function statistic(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
