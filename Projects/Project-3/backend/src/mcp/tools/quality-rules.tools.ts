import { z } from 'zod';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import { RULE_KINDS, RULE_SEVERITIES } from '#/files/quality/rules.js';
import {
  CreateQualityRuleDto,
  QualityRuleDto,
  QualityRulePageDto,
  UpdateQualityRuleDto,
} from '#/quality-rules/dto/quality-rule.dto.js';
import { defineTool, validated, type Tool } from '../tool.js';

const ruleId = z.uuid().describe('The rule’s id, from `list_quality_rules`.');
const params = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(
    'The rule’s numbers, by kind: max_null_percent { max: 0–100 }; type_is { type: integer | number | boolean | ' +
      'date | string, maxInconsistentPercent?: 0–100 }; min_value { min }; max_value { max }; max_duplicate_rows ' +
      '{ max }. required_column and unique take {}.',
  );

export const QUALITY_RULE_TOOLS: readonly Tool[] = [
  defineTool(
    {
      name: 'list_quality_rules',
      title: 'List data-quality rules',
      description:
        'The checks every upload of this company is held to. A rule about a column a file does not have is skipped ' +
        'for that file, not failed.',
      scope: 'files:read',
      roles: ['admin', 'employee'],
      write: false,
      needsPlan: true,
    },
    {
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async (input, s) => {
      const rules = await s.rules.list(await validated(OffsetQueryDto, input));
      return toDto(QualityRulePageDto, mapPageData(rules, QualityRuleDto.from));
    },
  ),

  defineTool(
    {
      name: 'create_quality_rule',
      title: 'Create a data-quality rule',
      description:
        'Adds a rule every future report is checked against (admin only; the plan limits how many). Existing ' +
        'reports are not changed until rebuilt. An `error` rule counts double in the score and notifies the ' +
        'uploader and admins when it fails.',
      scope: 'rules:write',
      roles: ['admin'],
      write: true,
      needsPlan: true,
    },
    {
      name: z.string().min(1).max(80),
      kind: z.enum(RULE_KINDS),
      columnName: z.string().min(1).max(200).optional().describe('The column, for every kind but max_duplicate_rows.'),
      params,
      severity: z.enum(RULE_SEVERITIES).optional(),
      enabled: z.boolean().optional(),
    },
    async (input, s) => QualityRuleDto.from(await s.rules.create(await validated(CreateQualityRuleDto, input))),
  ),

  defineTool(
    {
      name: 'update_quality_rule',
      title: 'Edit a data-quality rule',
      description:
        'Changes a rule’s name, column, numbers (`params` REPLACES them), severity or whether it is enabled. The ' +
        'kind cannot change: delete and create instead. Admin only.',
      scope: 'rules:write',
      roles: ['admin'],
      write: true,
      needsPlan: true,
      idempotent: true,
    },
    {
      id: ruleId,
      name: z.string().min(1).max(80).optional(),
      columnName: z.string().min(1).max(200).optional(),
      params,
      severity: z.enum(RULE_SEVERITIES).optional(),
      enabled: z.boolean().optional(),
    },
    async ({ id, ...changes }, s) =>
      QualityRuleDto.from(await s.rules.update(id, await validated(UpdateQualityRuleDto, changes))),
  ),

  defineTool(
    {
      name: 'delete_quality_rule',
      title: 'Delete a data-quality rule',
      description:
        'Removes a rule from future checks (admin only). Reports already built keep what they recorded. Returns the ' +
        'deleted rule.',
      scope: 'rules:write',
      roles: ['admin'],
      write: true,
      needsPlan: true,
      destructive: true,
      idempotent: true,
    },
    { id: ruleId },
    async ({ id }, s) => QualityRuleDto.from(await s.rules.remove(id)),
  ),
];
