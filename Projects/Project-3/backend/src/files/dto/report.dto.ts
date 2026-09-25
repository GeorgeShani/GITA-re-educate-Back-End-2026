import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { COLUMN_TYPES, type ColumnType } from '../quality/metrics.js';
import { REPORT_STATUSES, type ReportStatus } from '../data-quality-report.entity.js';
import { RULE_KINDS, RULE_SEVERITIES } from '../quality/rules.js';

class TypeCountsDto {
  @ApiProperty() @Expose() integer!: number;
  @ApiProperty() @Expose() number!: number;
  @ApiProperty() @Expose() boolean!: number;
  @ApiProperty() @Expose() date!: number;
  @ApiProperty() @Expose() string!: number;
}

class NumericStatsDto {
  @ApiProperty() @Expose() min!: number;
  @ApiProperty() @Expose() max!: number;
  @ApiProperty() @Expose() mean!: number;
}

export class ColumnMetricsDto {
  @ApiProperty() @Expose() index!: number;
  @ApiProperty() @Expose() name!: string;
  @ApiProperty({ description: 'Blank and whitespace-only cells count as empty.' })
  @Expose()
  nullCount!: number;
  @ApiProperty({ description: 'Percent of the column that is empty, 0–100, two decimals.' })
  @Expose()
  nullPercent!: number;
  @ApiProperty({ enum: COLUMN_TYPES, description: 'The dominant kind of value in the column.' })
  @Expose()
  inferredType!: ColumnType;
  @ApiProperty({ type: () => TypeCountsDto })
  @Expose()
  @Type(() => TypeCountsDto)
  typeCounts!: TypeCountsDto;
  @ApiProperty({ description: 'More than one kind of value in the column (numbers AND text, say).' })
  @Expose()
  inconsistent!: boolean;
  @ApiProperty({ description: 'Percent of non-empty cells that disagree with the dominant type.' })
  @Expose()
  inconsistentPercent!: number;
  @ApiProperty({ type: () => NumericStatsDto, nullable: true, description: 'Over the numeric cells; null if there are none.' })
  @Expose()
  @Type(() => NumericStatsDto)
  numeric!: NumericStatsDto | null;
}

export class MetricsDto {
  @ApiProperty({ description: 'Data rows profiled, header excluded.' }) @Expose() rowCount!: number;
  @ApiProperty() @Expose() columnCount!: number;
  @ApiProperty({ description: 'Rows with no value in any column.' }) @Expose() emptyRows!: number;
  @ApiProperty({ description: 'Rows identical to an earlier row.' }) @Expose() duplicateRows!: number;
  @ApiProperty({ description: 'Rows with more or fewer cells than the header.' }) @Expose() raggedRows!: number;
  @ApiProperty({ description: 'True when the file had more rows than the profile budget: the numbers cover the first `rowBudget` rows.' })
  @Expose()
  truncated!: boolean;
  @ApiProperty() @Expose() rowBudget!: number;
  @ApiProperty({ type: [String], description: 'Problems with the header row (blank or repeated names).' })
  @Expose()
  headerIssues!: string[];
  @ApiProperty({ type: () => [ColumnMetricsDto] })
  @Expose()
  @Type(() => ColumnMetricsDto)
  columns!: ColumnMetricsDto[];
}

export class NarrativeDto {
  @ApiProperty() @Expose() summary!: string;
  @ApiProperty({ type: [String] }) @Expose() recommendations!: string[];
  @ApiProperty({ description: 'The model that wrote it.' }) @Expose() model!: string;
}

export class RuleResultDto {
  @ApiProperty({ description: 'The rule this result is for (it may have been edited or deleted since).' })
  @Expose()
  ruleId!: string;

  @ApiProperty() @Expose() name!: string;

  @ApiProperty({ enum: RULE_KINDS }) @Expose() kind!: string;

  @ApiProperty({ type: String, nullable: true }) @Expose() columnName!: string | null;

  @ApiProperty({ enum: RULE_SEVERITIES }) @Expose() severity!: string;

  @ApiProperty({
    enum: ['passed', 'failed', 'skipped'],
    description: '`skipped`: the rule does not apply to this file (its column is not in it, or holds no numbers).',
  })
  @Expose()
  status!: string;

  @ApiProperty({ description: 'What was found and what was required, in words.' }) @Expose() message!: string;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'What the rule required when this report was built.' })
  @Expose()
  params!: Record<string, unknown>;
}

export class ReportDto {
  @ApiProperty() @Expose() fileId!: string;

  @ApiProperty({ enum: REPORT_STATUSES })
  @Expose()
  status!: ReportStatus;

  @ApiProperty({ type: () => MetricsDto, nullable: true, description: 'Present once `status` is `ready`.' })
  @Expose()
  @Type(() => MetricsDto)
  metrics!: MetricsDto | null;

  @ApiProperty({
    type: () => NarrativeDto,
    nullable: true,
    description: 'The plain-language summary. Null when no AI provider is configured or it produced nothing usable; the metrics are unaffected.',
  })
  @Expose()
  @Type(() => NarrativeDto)
  narrative!: NarrativeDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Why the report is `failed` or `unsupported`.' })
  @Expose()
  errorMessage!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  profiledAt!: Date | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'How the file did against the company’s quality rules, 0–100: the share of applicable rules it passed, an ' +
      '`error` rule counting double a `warning`. Null when no rule applied (or none is defined).',
  })
  @Expose()
  qualityScore!: number | null;

  @ApiProperty({
    type: () => [RuleResultDto],
    nullable: true,
    description:
      'One result per rule the company had when this report was built, each carrying the rule as it was then (rules ' +
      'can be edited later). Null when the company had no rules. Rebuild the report to check against today’s rules.',
  })
  @Expose()
  @Type(() => RuleResultDto)
  ruleResults!: RuleResultDto[] | null;
}

export class PreviewColumnDto {
  @ApiProperty() @Expose() name!: string;
  @ApiProperty({ enum: COLUMN_TYPES }) @Expose() inferredType!: ColumnType;
}

export class PreviewDto {
  @ApiProperty({ type: () => [PreviewColumnDto] })
  @Expose()
  @Type(() => PreviewColumnDto)
  columns!: PreviewColumnDto[];

  @ApiProperty({
    type: 'array',
    items: { type: 'array', items: { nullable: true, oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] } },
    description: 'The first rows, one array of cells per row in column order. Dates are ISO strings.',
  })
  @Expose()
  rows!: Array<Array<string | number | boolean | null>>;

  @ApiProperty({ description: 'Rows in the file (up to the profile budget).' })
  @Expose()
  totalRows!: number;

  @ApiProperty({ description: 'True when `rows` is only the first part of the file.' })
  @Expose()
  truncated!: boolean;
}
