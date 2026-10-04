import { sensitiveLabel } from "@/features/file-detail/sensitive";
import type { components } from "@/lib/api/schema";

export type Rule = components["schemas"]["QualityRuleDto"];
export type RuleKind = Rule["kind"];
export type Severity = Rule["severity"];
export type ColumnKind = "integer" | "number" | "boolean" | "date" | "string";

/** What a rule's author sees when choosing: the name, one sentence, and whether it needs a column. */
export interface KindInfo {
  kind: RuleKind;
  label: string;
  help: string;
  /** Every kind but one is about a single column. */
  needsColumn: boolean;
}

export const KINDS: readonly KindInfo[] = [
  {
    kind: "required_column",
    label: "Column is required",
    help: "The file must have this column.",
    needsColumn: true,
  },
  {
    kind: "max_null_percent",
    label: "Most empty cells",
    help: "At most this share of the column may be empty.",
    needsColumn: true,
  },
  {
    kind: "type_is",
    label: "Column type",
    help: "The column must hold this kind of data.",
    needsColumn: true,
  },
  {
    kind: "min_value",
    label: "Lowest value",
    help: "No number in the column may be below this.",
    needsColumn: true,
  },
  {
    kind: "max_value",
    label: "Highest value",
    help: "No number in the column may be above this.",
    needsColumn: true,
  },
  {
    kind: "unique",
    label: "Values are unique",
    help: "No value in the column may repeat.",
    needsColumn: true,
  },
  {
    kind: "max_duplicate_rows",
    label: "Most repeated rows",
    help: "At most this many whole rows may repeat. This one is about the whole file.",
    needsColumn: false,
  },
  {
    kind: "no_sensitive_data",
    label: "No personal data",
    help: "The file must not hold emails, phone numbers, card numbers or other personal or secret data. This one is about the whole file.",
    needsColumn: false,
  },
];

export function kindInfo(kind: RuleKind): KindInfo {
  return KINDS.find((entry) => entry.kind === kind) ?? KINDS[0];
}

export const COLUMN_KINDS: readonly { value: ColumnKind; label: string }[] = [
  { value: "integer", label: "Whole numbers" },
  { value: "number", label: "Numbers" },
  { value: "boolean", label: "Yes / no" },
  { value: "date", label: "Dates" },
  { value: "string", label: "Text" },
];

function toColumnKind(value: unknown): ColumnKind | null {
  return COLUMN_KINDS.find((entry) => entry.value === value)?.value ?? null;
}

function numberOf(params: Rule["params"], key: string): number | null {
  const value = params[key];
  return typeof value === "number" ? value : null;
}

const count = (value: number) =>
  value.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** One plain sentence for a rule, the way a report would say it: `At most 5% of "email" may be empty.` */
export function describeRule(rule: Rule): string {
  const column = `“${rule.columnName ?? ""}”`;
  switch (rule.kind) {
    case "required_column":
      return `The ${column} column must be there.`;
    case "max_null_percent": {
      const max = numberOf(rule.params, "max");
      return max === null
        ? `${column} has a limit on empty cells.`
        : `At most ${count(max)}% of ${column} may be empty.`;
    }
    case "type_is": {
      const kind = toColumnKind(rule.params.type);
      const label = COLUMN_KINDS.find((entry) => entry.value === kind)?.label;
      const slack = numberOf(rule.params, "maxInconsistentPercent") ?? 0;
      const base = `${column} must hold ${label ? label.toLowerCase() : "one kind of value"}.`;
      return slack > 0 ? `${base} Up to ${count(slack)}% may disagree.` : base;
    }
    case "min_value": {
      const min = numberOf(rule.params, "min");
      return min === null
        ? `${column} has a lowest value.`
        : `${column} is never below ${count(min)}.`;
    }
    case "max_value": {
      const max = numberOf(rule.params, "max");
      return max === null
        ? `${column} has a highest value.`
        : `${column} is never above ${count(max)}.`;
    }
    case "unique":
      return `Every value in ${column} is different.`;
    case "no_sensitive_data": {
      const kind =
        typeof rule.params.kind === "string" ? rule.params.kind : "any";
      return kind === "any"
        ? "The file holds no personal or secret data."
        : `The file holds no ${sensitiveLabel(kind)}.`;
    }
    case "max_duplicate_rows": {
      const max = numberOf(rule.params, "max");
      if (max === 0) return "No row may repeat.";
      return max === null
        ? "Repeated rows are limited."
        : `At most ${count(max)} ${max === 1 ? "row" : "rows"} may repeat.`;
    }
  }
}

/** Everything the form holds, as text, so a half-typed number is not forced into a value. */
export interface RuleForm {
  name: string;
  kind: RuleKind;
  column: string;
  severity: Severity;
  enabled: boolean;
  max: string;
  min: string;
  columnKind: ColumnKind;
  slack: string;
  /** For "No personal data": any, or one kind of it. */
  sensitiveKind: string;
}

export const EMPTY_FORM: RuleForm = {
  name: "",
  kind: "max_null_percent",
  column: "",
  severity: "error",
  enabled: true,
  max: "",
  min: "",
  columnKind: "string",
  slack: "0",
  sensitiveKind: "any",
};

export function formFromRule(rule: Rule): RuleForm {
  const max = numberOf(rule.params, "max");
  const min = numberOf(rule.params, "min");
  const slack = numberOf(rule.params, "maxInconsistentPercent");
  return {
    name: rule.name,
    kind: rule.kind,
    column: rule.columnName ?? "",
    severity: rule.severity,
    enabled: rule.enabled,
    max: max === null ? "" : String(max),
    min: min === null ? "" : String(min),
    columnKind: toColumnKind(rule.params.type) ?? "string",
    slack: slack === null ? "0" : String(slack),
    sensitiveKind:
      typeof rule.params.kind === "string" ? rule.params.kind : "any",
  };
}

function parse(text: string): number | null {
  if (text.trim() === "") return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export type Built =
  | {
      ok: true;
      body: {
        name: string;
        columnName?: string;
        params: Record<string, string | number>;
        severity: Severity;
        enabled: boolean;
      };
    }
  | { ok: false; error: string };

/**
 * The request for a form, or the first thing wrong with it in words a person can act on. The API checks all of this again;
 * this saves a round trip for the obvious mistakes.
 */
export function buildRule(form: RuleForm): Built {
  const name = form.name.trim();
  if (name === "") return { ok: false, error: "Give the rule a name." };
  if (name.length > 80) {
    return { ok: false, error: "Keep the name to 80 characters or fewer." };
  }
  const info = kindInfo(form.kind);
  const column = form.column.trim();
  if (info.needsColumn && column === "") {
    return {
      ok: false,
      error: "Type the column's name, as it appears in the file's header.",
    };
  }

  const params: Record<string, string | number> = {};
  switch (form.kind) {
    case "max_null_percent": {
      const max = parse(form.max);
      if (max === null || max < 0 || max > 100) {
        return { ok: false, error: "Enter a percentage from 0 to 100." };
      }
      params.max = max;
      break;
    }
    case "type_is": {
      const slack = parse(form.slack);
      if (slack === null || slack < 0 || slack > 100) {
        return {
          ok: false,
          error: "The share allowed to disagree is a percentage from 0 to 100.",
        };
      }
      params.type = form.columnKind;
      params.maxInconsistentPercent = slack;
      break;
    }
    case "min_value": {
      const min = parse(form.min);
      if (min === null) return { ok: false, error: "Enter the lowest value." };
      params.min = min;
      break;
    }
    case "max_value": {
      const max = parse(form.max);
      if (max === null) return { ok: false, error: "Enter the highest value." };
      params.max = max;
      break;
    }
    case "max_duplicate_rows": {
      const max = parse(form.max);
      if (max === null || !Number.isInteger(max) || max < 0) {
        return {
          ok: false,
          error:
            "Enter how many repeated rows are allowed: a whole number, 0 or more.",
        };
      }
      params.max = max;
      break;
    }
    case "no_sensitive_data":
      params.kind = form.sensitiveKind;
      break;
    case "required_column":
    case "unique":
      break;
  }

  return {
    ok: true,
    body: {
      name,
      ...(info.needsColumn ? { columnName: column } : {}),
      params,
      severity: form.severity,
      enabled: form.enabled,
    },
  };
}
