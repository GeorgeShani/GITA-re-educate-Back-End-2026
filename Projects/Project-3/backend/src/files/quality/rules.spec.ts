import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { type CellValue, MetricsAccumulator } from './metrics.js';
import {
  type RuleDefinition,
  type RuleSpec,
  evaluateRules,
  qualityScore,
  ruleResultSchema,
  ruleSpecSchema,
  uniqueColumnKeys,
} from './rules.js';

function metricsOf(header: CellValue[], rows: CellValue[][], uniqueColumns: string[] = []) {
  const accumulator = new MetricsAccumulator(header, { uniqueColumns: new Set(uniqueColumns) });
  for (const row of rows) accumulator.addRow(row);
  return { metrics: accumulator.finish(), uniqueness: accumulator.uniqueness() };
}

function rule(
  spec: RuleSpec,
  columnName: string | null,
  extra: Partial<Pick<RuleDefinition, 'name' | 'severity'>> = {},
): RuleDefinition {
  return { ...spec, id: randomUUID(), name: extra.name ?? spec.kind, columnName, severity: extra.severity ?? 'error' };
}

const one = (definition: RuleDefinition, data: ReturnType<typeof metricsOf>) =>
  evaluateRules(data.metrics, [definition], data.uniqueness).results[0];

describe('ruleSpecSchema', () => {
  it('accepts each kind with its own parameters and fills defaults', () => {
    expect(ruleSpecSchema.parse({ kind: 'required_column', params: {} })).toEqual({ kind: 'required_column', params: {} });
    expect(ruleSpecSchema.parse({ kind: 'max_null_percent', params: { max: 10 } }).params).toEqual({ max: 10 });
    expect(ruleSpecSchema.parse({ kind: 'type_is', params: { type: 'integer' } }).params).toEqual({
      type: 'integer',
      maxInconsistentPercent: 0,
    });
    expect(ruleSpecSchema.parse({ kind: 'unique', params: {} }).kind).toBe('unique');
    expect(ruleSpecSchema.parse({ kind: 'max_duplicate_rows', params: { max: 0 } }).params).toEqual({ max: 0 });
  });

  it.each([
    ['an unknown kind', { kind: 'starts_with', params: {} }],
    ['a percentage over 100', { kind: 'max_null_percent', params: { max: 101 } }],
    ['a negative percentage', { kind: 'max_null_percent', params: { max: -1 } }],
    ['a missing parameter', { kind: 'min_value', params: {} }],
    ['an unknown parameter', { kind: 'unique', params: { strict: true } }],
    ['a non-integer duplicate count', { kind: 'max_duplicate_rows', params: { max: 1.5 } }],
    ['the empty type', { kind: 'type_is', params: { type: 'empty' } }],
    ['a non-number bound', { kind: 'max_value', params: { max: '10' } }],
  ])('rejects %s', (_name, input) => {
    expect(ruleSpecSchema.safeParse(input).success).toBe(false);
  });
});

describe('evaluateRules', () => {
  describe('required_column', () => {
    it('passes when the column is there (any case), fails when it is not', () => {
      const data = metricsOf(['Email', 'Name'], []);
      expect(one(rule({ kind: 'required_column', params: {} }, 'email'), data)?.status).toBe('passed');
      const missing = one(rule({ kind: 'required_column', params: {} }, 'phone'), data);
      expect(missing).toMatchObject({ status: 'failed', message: 'Column "phone" is missing.' });
    });
  });

  describe('max_null_percent', () => {
    const data = metricsOf(['a'], [['1'], [''], ['3'], [null]]); // 50% empty
    const at = (max: number) => one(rule({ kind: 'max_null_percent', params: { max } }, 'a'), data);

    it('passes at exactly the limit and fails just under it', () => {
      expect(at(50)?.status).toBe('passed');
      expect(at(49.99)?.status).toBe('failed');
      expect(at(50)?.message).toBe('50% of "a" is empty; at most 50% allowed.');
    });

    it('a fully empty column is 100% empty', () => {
      const empty = metricsOf(['a'], [[null], [null]]);
      expect(one(rule({ kind: 'max_null_percent', params: { max: 99 } }, 'a'), empty)?.status).toBe('failed');
    });

    it('a file with no rows has nothing empty', () => {
      expect(one(rule({ kind: 'max_null_percent', params: { max: 0 } }, 'a'), metricsOf(['a'], []))?.status).toBe('passed');
    });
  });

  describe('type_is', () => {
    it('passes for the right type with no disagreement, and treats integers as numbers', () => {
      const ints = metricsOf(['n'], [['1'], ['2']]);
      expect(one(rule({ kind: 'type_is', params: { type: 'integer', maxInconsistentPercent: 0 } }, 'n'), ints)?.status).toBe('passed');
      expect(one(rule({ kind: 'type_is', params: { type: 'number', maxInconsistentPercent: 0 } }, 'n'), ints)?.status).toBe('passed');
      const decimals = metricsOf(['n'], [['1.5'], ['2']]);
      expect(one(rule({ kind: 'type_is', params: { type: 'integer', maxInconsistentPercent: 0 } }, 'n'), decimals)?.status).toBe('failed');
    });

    it('fails when the dominant type is another one', () => {
      const text = metricsOf(['n'], [['a'], ['b'], ['1']]);
      expect(one(rule({ kind: 'type_is', params: { type: 'integer', maxInconsistentPercent: 100 } }, 'n'), text)).toMatchObject({
        status: 'failed',
        message: '"n" is string, not integer.',
      });
    });

    it('tolerates disagreement up to the limit', () => {
      const mixed = metricsOf(['n'], [['1'], ['2'], ['3'], ['x']]); // 25% disagree
      const at = (maxInconsistentPercent: number) =>
        one(rule({ kind: 'type_is', params: { type: 'integer', maxInconsistentPercent } }, 'n'), mixed)?.status;
      expect(at(25)).toBe('passed');
      expect(at(24)).toBe('failed');
      expect(at(0)).toBe('failed');
    });

    it('an all-empty column is not any type', () => {
      const empty = metricsOf(['n'], [[null]]);
      expect(one(rule({ kind: 'type_is', params: { type: 'string', maxInconsistentPercent: 100 } }, 'n'), empty)?.status).toBe('failed');
    });
  });

  describe('min_value and max_value', () => {
    const data = metricsOf(['amount'], [['5'], ['-3'], ['100']]);

    it('compare against the smallest and largest number, inclusive', () => {
      expect(one(rule({ kind: 'min_value', params: { min: -3 } }, 'amount'), data)?.status).toBe('passed');
      expect(one(rule({ kind: 'min_value', params: { min: -2 } }, 'amount'), data)).toMatchObject({
        status: 'failed',
        message: 'Smallest value in "amount" is -3; at least -2 required.',
      });
      expect(one(rule({ kind: 'max_value', params: { max: 100 } }, 'amount'), data)?.status).toBe('passed');
      expect(one(rule({ kind: 'max_value', params: { max: 99.5 } }, 'amount'), data)?.status).toBe('failed');
    });

    it('skip a column that holds no numbers, rather than failing it', () => {
      const text = metricsOf(['amount'], [['a'], ['b']]);
      expect(one(rule({ kind: 'min_value', params: { min: 0 } }, 'amount'), text)).toMatchObject({
        status: 'skipped',
        message: '"amount" holds no numbers.',
      });
      expect(one(rule({ kind: 'max_value', params: { max: 0 } }, 'amount'), text)?.status).toBe('skipped');
    });
  });

  describe('unique', () => {
    it('passes with no repeats, and counts each repeated value when there are', () => {
      const clean = metricsOf(['id'], [['a'], ['b']], ['id']);
      expect(one(rule({ kind: 'unique', params: {} }, 'id'), clean)?.status).toBe('passed');
      const dirty = metricsOf(['id'], [['a'], ['a'], ['b'], ['b'], ['b']], ['id']);
      expect(one(rule({ kind: 'unique', params: {} }, 'id'), dirty)).toMatchObject({
        status: 'failed',
        message: '3 repeated values in "id"; every value must be unique.',
      });
    });

    it('is skipped when the values were not tracked', () => {
      const untracked = metricsOf(['id'], [['a'], ['a']]);
      expect(one(rule({ kind: 'unique', params: {} }, 'id'), untracked)?.status).toBe('skipped');
    });
  });

  describe('max_duplicate_rows', () => {
    it('is about the whole file and needs no column', () => {
      const data = metricsOf(['a'], [['1'], ['1'], ['1']]); // two repeats of the first row
      expect(one(rule({ kind: 'max_duplicate_rows', params: { max: 2 } }, null), data)?.status).toBe('passed');
      expect(one(rule({ kind: 'max_duplicate_rows', params: { max: 1 } }, null), data)).toMatchObject({
        status: 'failed',
        message: '2 duplicate rows; at most 1 allowed.',
      });
    });
  });

  describe('a rule about a column the file does not have', () => {
    it('is skipped, not failed: rules cover every upload, and only required_column demands a column', () => {
      const data = metricsOf(['other'], [['1']]);
      for (const spec of [
        { kind: 'max_null_percent', params: { max: 0 } },
        { kind: 'min_value', params: { min: 0 } },
        { kind: 'unique', params: {} },
        { kind: 'type_is', params: { type: 'integer', maxInconsistentPercent: 0 } },
      ] as const) {
        expect(one(rule(spec, 'amount'), data)).toMatchObject({ status: 'skipped', message: 'Column "amount" is not in this file.' });
      }
    });
  });

  it('says so when only part of a big file was checked', () => {
    const data = metricsOf(['a'], [['1']]);
    data.metrics.truncated = true;
    expect(one(rule({ kind: 'max_null_percent', params: { max: 5 } }, 'a'), data)?.message).toMatch(/only the first \d+ rows were checked/);
  });

  it('keeps a snapshot of each rule, so a result outlives the rule', () => {
    const definition = rule({ kind: 'max_null_percent', params: { max: 5 } }, 'a', { name: 'Filled in', severity: 'warning' });
    const [result] = evaluateRules(metricsOf(['a'], [['1']]).metrics, [definition]).results;

    expect(ruleResultSchema.parse(result)).toEqual({
      ruleId: definition.id,
      name: 'Filled in',
      kind: 'max_null_percent',
      columnName: 'a',
      severity: 'warning',
      status: 'passed',
      message: '0% of "a" is empty; at most 5% allowed.',
      params: { max: 5 },
    });
  });

  it('returns results in the order the rules were given', () => {
    const data = metricsOf(['a'], [['1']]);
    const rules = [
      rule({ kind: 'required_column', params: {} }, 'a', { name: 'first' }),
      rule({ kind: 'required_column', params: {} }, 'b', { name: 'second' }),
    ];
    expect(evaluateRules(data.metrics, rules).results.map((result) => result.name)).toEqual(['first', 'second']);
  });
});

describe('qualityScore', () => {
  const result = (status: 'passed' | 'failed' | 'skipped', severity: 'error' | 'warning') => ({
    ruleId: randomUUID(),
    name: 'r',
    kind: 'unique' as const,
    columnName: 'a',
    severity,
    status,
    message: '',
    params: {},
  });

  it('is null when no rule applied, and 100 when every applicable one passed', () => {
    expect(qualityScore([])).toBeNull();
    expect(qualityScore([result('skipped', 'error')])).toBeNull();
    expect(qualityScore([result('passed', 'error'), result('passed', 'warning'), result('skipped', 'error')])).toBe(100);
  });

  it('counts an error twice a warning', () => {
    // error fails (0 of 2), warning passes (1 of 1): 1 of 3
    expect(qualityScore([result('failed', 'error'), result('passed', 'warning')])).toBe(33);
    // error passes (2 of 2), warning fails (0 of 1): 2 of 3
    expect(qualityScore([result('passed', 'error'), result('failed', 'warning')])).toBe(67);
  });

  it('is 0 when everything applicable failed', () => {
    expect(qualityScore([result('failed', 'warning'), result('failed', 'error')])).toBe(0);
  });

  it('ignores skipped rules entirely', () => {
    expect(qualityScore([result('passed', 'warning'), result('skipped', 'error'), result('skipped', 'error')])).toBe(100);
  });
});

describe('uniqueColumnKeys', () => {
  it('collects the lower-cased columns of unique rules only', () => {
    const rules = [
      rule({ kind: 'unique', params: {} }, 'Order_ID'),
      rule({ kind: 'max_null_percent', params: { max: 1 } }, 'other'),
      rule({ kind: 'max_duplicate_rows', params: { max: 0 } }, null),
    ];
    expect([...uniqueColumnKeys(rules)]).toEqual(['order_id']);
  });
});
