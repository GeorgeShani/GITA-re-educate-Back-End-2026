import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { OffsetPageOf } from '#/common/pagination/offset-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { RULE_KINDS, RULE_SEVERITIES, type RuleSeverity } from '#/files/quality/rules.js';
import type { QualityRule } from '../quality-rule.entity.js';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

const PARAMS_DOC =
  'The rule’s numbers, by `kind`: `max_null_percent` `{ max: 0–100 }`; `type_is` `{ type: integer | number | ' +
  'boolean | date | string, maxInconsistentPercent?: 0–100 (default 0) }`; `min_value` `{ min }`; `max_value` ' +
  '`{ max }`; `max_duplicate_rows` `{ max }`. `required_column` and `unique` take `{}`.';

export class CreateQualityRuleDto {
  @ApiProperty({ example: 'Emails are filled in', minLength: 1, maxLength: 80 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    enum: RULE_KINDS,
    description:
      '`required_column` the column must exist; `max_null_percent` at most that share empty; `type_is` the column is ' +
      'that type; `min_value` / `max_value` numeric bounds; `unique` no value repeats; `max_duplicate_rows` (whole file, ' +
      'no column) at most that many repeated rows.',
  })
  @IsIn(RULE_KINDS)
  kind!: (typeof RULE_KINDS)[number];

  @ApiPropertyOptional({
    example: 'email',
    description:
      'The column it applies to, matched to a file’s header case-insensitively. Required for every kind but ' +
      '`max_duplicate_rows`, which takes none. A file without that column skips the rule (use `required_column` to demand one).',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  columnName?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: PARAMS_DOC })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: RULE_SEVERITIES,
    default: 'error',
    description: 'An `error` counts double in the quality score, and a failing one notifies the uploader and the admins.',
  })
  @IsOptional()
  @IsIn(RULE_SEVERITIES)
  severity?: RuleSeverity;

  @ApiPropertyOptional({ default: true, description: 'A disabled rule is kept, and counts toward the plan’s limit, but is not checked.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

/** At least one field is required; the service rejects an empty body. The `kind` cannot change. */
export class UpdateQualityRuleDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 80 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ maxLength: 200, description: 'Only for a rule that is about a column.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  columnName?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: `REPLACES the rule’s numbers. ${PARAMS_DOC}` })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: RULE_SEVERITIES })
  @IsOptional()
  @IsIn(RULE_SEVERITIES)
  severity?: RuleSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class QualityRuleDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ enum: RULE_KINDS })
  @Expose()
  kind!: string;

  @ApiProperty({ type: String, nullable: true, description: 'Null for a rule about the whole file.' })
  @Expose()
  columnName!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @Expose()
  params!: unknown;

  @ApiProperty({ enum: RULE_SEVERITIES })
  @Expose()
  severity!: string;

  @ApiProperty()
  @Expose()
  enabled!: boolean;

  @ApiProperty({ description: 'The admin who created it.' })
  @Expose()
  createdByUserId!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  updatedAt!: Date;

  static from(rule: QualityRule): QualityRuleDto {
    return toDto(QualityRuleDto, rule);
  }
}

export class QualityRulePageDto extends OffsetPageOf(QualityRuleDto) {}
