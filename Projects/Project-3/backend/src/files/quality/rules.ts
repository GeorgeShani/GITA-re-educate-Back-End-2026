import { z } from 'zod';
import { COLUMN_TYPES, type ColumnMetrics, type DataQualityMetrics, columnKey } from './metrics.js';

export const RULE_SEVERITIES = ['error', 'warning'] as const;
export type RuleSeverity = (typeof RULE_SEVERITIES)[number];

/** The kinds of rule, and each kind's parameters. `params` is `jsonb`: parsed through this, never trusted. */
export const ruleSpecSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('required_column'), params: z.object({}).strict() }),
  z.object({
    kind: z.literal('max_null_percent'),
    params: z.object({ max: z.number().min(0).max(100) }).strict(),
  }),
  z.object({
    kind: z.literal('type_is'),
    params: z
      .object({
        type: z.enum(COLUMN_TYPES).exclude(['empty']),
        /** How much of the column may disagree with the type before the rule fails. */
        maxInconsistentPercent: z.number().min(0).max(100).default(0),
      })
      .strict(),
  }),
  z.object({ kind: z.literal('min_value'), params: z.object({ min: z.number() }).strict() }),
  z.object({ kind: z.literal('max_value'), params: z.object({ max: z.number() }).strict() }),
  z.object({ kind: z.literal('unique'), params: z.object({}).strict() }),
  z.object({
    kind: z.literal('max_duplicate_rows'),
    params: z.object({ max: z.number().int().min(0) }).strict(),
  }),
]);
export type RuleSpec = z.infer<typeof ruleSpecSchema>;
export type RuleKind = RuleSpec['kind'];
export const RULE_KINDS = ruleSpecSchema.options.map((option) => option.shape.kind.value);

/** Every kind but this one is about ONE column, so it names it. */
export const FILE_LEVEL_RULE_KINDS: readonly RuleKind[] = ['max_duplicate_rows'];
export const isColumnRule = (kind: RuleKind): boolean => !FILE_LEVEL_RULE_KINDS.includes(kind);

/** A rule as the evaluator needs it (a stored row, once its `params` has been parsed). */
export type RuleDefinition = RuleSpec & {
  id: string;
  name: string;
  /** The column it applies to, as the company typed it; null for a file-level rule. */
  columnName: string | null;
  severity: RuleSeverity;
};

export const ruleResultSchema = z.object({
  ruleId: z.uuid(),
  name: z.string(),
  kind: z.enum(RULE_KINDS),
  columnName: z.string().nullable(),
  severity: z.enum(RULE_SEVERITIES),
  /** `skipped`: the rule does not apply to this file (its column is not there, or holds no numbers). */
  status: z.enum(['passed', 'failed', 'skipped']),
  message: z.string(),
  /** What the rule required, as it was when the report was built (rules can be edited later). */
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
export type RuleResult = z.infer<typeof ruleResultSchema>;

/** Values that occur more than once, per unique-checked column (keyed by `columnKey`). */
export type Uniqueness = Readonly<Record<string, number>>;

const WEIGHT: Record<RuleSeverity, number> = { error: 2, warning: 1 };

interface Outcome {
  status: RuleResult['status'];
  message: string;
}
const pass = (message: string): Outcome => ({ status: 'passed', message });
const fail = (message: string): Outcome => ({ status: 'failed', message });
const skip = (message: string): Outcome => ({ status: 'skipped', message });

const fmt = (value: number): string => (Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100));

function evaluateOne(
  rule: RuleDefinition,
  metrics: DataQualityMetrics,
  uniqueness: Uniqueness,
): Outcome {
  if (rule.kind === 'max_duplicate_rows') {
    const { max } = rule.params;
    const found = metrics.duplicateRows;
    return found <= max
      ? pass(`${found} duplicate ${found === 1 ? 'row' : 'rows'}; at most ${max} allowed.`)
      : fail(`${found} duplicate ${found === 1 ? 'row' : 'rows'}; at most ${max} allowed.`);
  }

  const wanted = rule.columnName === null ? '' : columnKey(rule.columnName);
  const column: ColumnMetrics | undefined = metrics.columns.find((candidate) => columnKey(candidate.name) === wanted);
  const label = `"${rule.columnName ?? ''}"`;
  const partial = metrics.truncated ? ` (only the first ${metrics.rowBudget} rows were checked)` : '';

  if (rule.kind === 'required_column') {
    return column ? pass(`Column ${label} is present.`) : fail(`Column ${label} is missing.`);
  }
  // A rule about a column the file does not have does not apply to it: rules cover every upload of the
  // company, and a file with no `amount` column is not "wrong" for it (`required_column` is how to demand one).
  if (!column) return skip(`Column ${label} is not in this file.`);

  switch (rule.kind) {
    case 'max_null_percent': {
      const { max } = rule.params;
      const text = `${fmt(column.nullPercent)}% of ${label} is empty; at most ${fmt(max)}% allowed${partial}.`;
      return column.nullPercent <= max ? pass(text) : fail(text);
    }
    case 'type_is': {
      const { type, maxInconsistentPercent } = rule.params;
      const typeOk = column.inferredType === type || (type === 'number' && column.inferredType === 'integer');
      const text = typeOk
        ? `${label} is ${column.inferredType}; ${fmt(column.inconsistentPercent)}% of values disagree, at most ${fmt(maxInconsistentPercent)}% allowed${partial}.`
        : `${label} is ${column.inferredType}, not ${type}.`;
      return typeOk && column.inconsistentPercent <= maxInconsistentPercent ? pass(text) : fail(text);
    }
    case 'min_value': {
      if (!column.numeric) return skip(`${label} holds no numbers.`);
      const { min } = rule.params;
      const text = `Smallest value in ${label} is ${fmt(column.numeric.min)}; at least ${fmt(min)} required${partial}.`;
      return column.numeric.min >= min ? pass(text) : fail(text);
    }
    case 'max_value': {
      if (!column.numeric) return skip(`${label} holds no numbers.`);
      const { max } = rule.params;
      const text = `Largest value in ${label} is ${fmt(column.numeric.max)}; at most ${fmt(max)} allowed${partial}.`;
      return column.numeric.max <= max ? pass(text) : fail(text);
    }
    case 'unique': {
      const repeated = uniqueness[wanted];
      if (repeated === undefined) return skip(`Uniqueness of ${label} was not checked.`);
      const text =
        repeated === 0
          ? `Every value in ${label} is unique${partial}.`
          : `${repeated} repeated ${repeated === 1 ? 'value' : 'values'} in ${label}; every value must be unique${partial}.`;
      return repeated === 0 ? pass(text) : fail(text);
    }
  }
}

/**
 * Checks a file's metrics against a company's rules. Pure: aggregates in, results out — the rules
 * never see a row. Each result carries a SNAPSHOT of its rule (name, kind, params, severity), so
 * editing or deleting a rule later never rewrites what an earlier report said.
 *
 * `score` is the share of applicable rules that passed, 0–100, an `error` counting twice a
 * `warning`; a skipped rule counts for nothing, and with no applicable rule there is no score.
 */
export function evaluateRules(
  metrics: DataQualityMetrics,
  rules: readonly RuleDefinition[],
  uniqueness: Uniqueness = {},
): { results: RuleResult[]; score: number | null } {
  const results = rules.map((rule): RuleResult => {
    const outcome = evaluateOne(rule, metrics, uniqueness);
    return {
      ruleId: rule.id,
      name: rule.name,
      kind: rule.kind,
      columnName: rule.columnName,
      severity: rule.severity,
      status: outcome.status,
      message: outcome.message,
      params: { ...rule.params },
    };
  });
  return { results, score: qualityScore(results) };
}

export function qualityScore(results: readonly RuleResult[]): number | null {
  let earned = 0;
  let possible = 0;
  for (const result of results) {
    if (result.status === 'skipped') continue;
    possible += WEIGHT[result.severity];
    if (result.status === 'passed') earned += WEIGHT[result.severity];
  }
  return possible === 0 ? null : Math.round((earned / possible) * 100);
}

/** The columns whose values must be tracked for uniqueness while the file is read. */
export function uniqueColumnKeys(rules: readonly RuleDefinition[]): Set<string> {
  const keys = new Set<string>();
  for (const rule of rules) {
    if (rule.kind === 'unique' && rule.columnName !== null) keys.add(columnKey(rule.columnName));
  }
  return keys;
}
