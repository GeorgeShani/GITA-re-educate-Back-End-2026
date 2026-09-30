/**
 * Two invented files for the landing page. Nothing here is customer data or a measured result. The scoring follows the
 * product's rule: the share of applicable rules passed, an error counting twice and a warning once.
 */
export type Severity = "error" | "warning";

export interface Check {
  text: string;
  result: string;
  ok: boolean;
  severity: Severity;
}

export interface Sample {
  id: string;
  file: string;
  rows: number;
  columns: number;
  size: string;
  checks: Check[];
  access: string;
}

export const SAMPLES: Sample[] = [
  {
    id: "payroll",
    file: "payroll-march.csv",
    rows: 1204,
    columns: 7,
    size: "214 KB",
    access: "Restricted to 2 people",
    checks: [
      {
        text: "employee_id column is present",
        result: "found",
        ok: true,
        severity: "error",
      },
      {
        text: "Empty cells in amount, at most 5%",
        result: "0.4%",
        ok: true,
        severity: "error",
      },
      {
        text: "amount holds numbers",
        result: "every row",
        ok: true,
        severity: "error",
      },
      {
        text: "employee_id is unique",
        result: "1,204 of 1,204",
        ok: true,
        severity: "warning",
      },
      {
        text: "No duplicate rows",
        result: "0 found",
        ok: true,
        severity: "warning",
      },
    ],
  },
  {
    id: "inventory",
    file: "inventory-q2.csv",
    rows: 8930,
    columns: 9,
    size: "1.6 MB",
    access: "Whole company",
    checks: [
      {
        text: "sku column is present",
        result: "found",
        ok: true,
        severity: "error",
      },
      {
        text: "Empty cells in unit_cost, at most 5%",
        result: "12.8%",
        ok: false,
        severity: "error",
      },
      {
        text: "qty holds whole numbers",
        result: "every row",
        ok: true,
        severity: "error",
      },
      {
        text: "sku is unique",
        result: "14 repeated",
        ok: false,
        severity: "warning",
      },
      {
        text: "No duplicate rows",
        result: "0 found",
        ok: true,
        severity: "warning",
      },
    ],
  },
];

const WEIGHT: Record<Severity, number> = { error: 2, warning: 1 };

export function scoreOf(checks: Check[]): number {
  const total = checks.reduce((sum, check) => sum + WEIGHT[check.severity], 0);
  const passed = checks
    .filter((check) => check.ok)
    .reduce((sum, check) => sum + WEIGHT[check.severity], 0);
  return total === 0 ? 0 : Math.round((passed / total) * 100);
}

/** A file is held when any error-severity rule failed. */
export function isHeld(checks: Check[]): boolean {
  return checks.some((check) => !check.ok && check.severity === "error");
}

export function failedCount(checks: Check[]): number {
  return checks.filter((check) => !check.ok).length;
}
