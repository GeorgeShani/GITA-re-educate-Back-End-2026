import type { DataSource, EntityManager } from 'typeorm';
import { z } from 'zod';
import { type RuleDefinition, RULE_SEVERITIES, ruleSpecSchema } from '#/files/quality/rules.js';
import { QualityRule } from './quality-rule.entity.js';

const severitySchema = z.enum(RULE_SEVERITIES);

/**
 * A stored rule as the evaluator needs it, with its `params` parsed. A row that no longer parses (a
 * kind that was renamed under old data) is `null`: one bad rule must not stop a file being profiled.
 */
export function toDefinition(row: QualityRule): RuleDefinition | null {
  const spec = ruleSpecSchema.safeParse({ kind: row.kind, params: row.params });
  const severity = severitySchema.safeParse(row.severity);
  if (!spec.success || !severity.success) return null;
  return { ...spec.data, id: row.id, name: row.name, columnName: row.columnName, severity: severity.data };
}

/** The company's enabled rules, oldest first (the order results are shown in). */
export async function loadEnabledRules(
  source: DataSource | EntityManager,
  companyId: string,
): Promise<{ rules: RuleDefinition[]; unreadable: number }> {
  const rows = await source
    .getRepository(QualityRule)
    .find({ where: { companyId, enabled: true }, order: { createdAt: 'ASC', id: 'ASC' } });
  const rules: RuleDefinition[] = [];
  for (const row of rows) {
    const definition = toDefinition(row);
    if (definition) rules.push(definition);
  }
  return { rules, unreadable: rows.length - rules.length };
}
