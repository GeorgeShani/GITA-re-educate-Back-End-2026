import {
  ArgsType,
  Field,
  Float,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { FILE_SORTS, type FileSort } from '#/files/dto/files-query.dto.js';
import { FILE_VISIBILITIES, type FileVisibility } from '#/files/file-asset.entity.js';
import type { ColumnType } from '#/files/quality/metrics.js';
import type { ReportStatus } from '#/files/data-quality-report.entity.js';
import type { RuleKind, RuleSeverity } from '#/files/quality/rules.js';
import { SPREADSHEET_MIME_TYPES, type SpreadsheetMime } from '#/files/spreadsheet-types.js';

const FILE_VISIBILITY_VALUES: Record<FileVisibility, FileVisibility> = {
  company: 'company',
  restricted: 'restricted',
};
const FILE_SORT_VALUES: Record<'NEWEST' | 'OLDEST', FileSort> = {
  NEWEST: '-createdAt',
  OLDEST: 'createdAt',
};
const MIME_VALUES: Record<'CSV' | 'XLS' | 'XLSX', SpreadsheetMime> = {
  CSV: 'text/csv',
  XLS: 'application/vnd.ms-excel',
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
const REPORT_STATUS_VALUES: Record<ReportStatus, ReportStatus> = {
  queued: 'queued',
  profiling: 'profiling',
  ready: 'ready',
  unsupported: 'unsupported',
  failed: 'failed',
};
const COLUMN_TYPE_VALUES: Record<ColumnType, ColumnType> = {
  integer: 'integer',
  number: 'number',
  boolean: 'boolean',
  date: 'date',
  string: 'string',
  empty: 'empty',
};
const RULE_KIND_VALUES: Record<RuleKind, RuleKind> = {
  required_column: 'required_column',
  max_null_percent: 'max_null_percent',
  type_is: 'type_is',
  min_value: 'min_value',
  max_value: 'max_value',
  unique: 'unique',
  max_duplicate_rows: 'max_duplicate_rows',
};
const RULE_SEVERITY_VALUES: Record<RuleSeverity, RuleSeverity> = {
  error: 'error',
  warning: 'warning',
};
const RULE_RESULT_STATUS_VALUES = {
  passed: 'passed',
  failed: 'failed',
  skipped: 'skipped',
};

registerEnumType(FILE_VISIBILITY_VALUES, { name: 'FileVisibility' });
registerEnumType(FILE_SORT_VALUES, { name: 'FileSort' });
registerEnumType(MIME_VALUES, { name: 'SpreadsheetMimeType' });
registerEnumType(REPORT_STATUS_VALUES, { name: 'ReportStatus' });
registerEnumType(COLUMN_TYPE_VALUES, { name: 'ColumnType' });
registerEnumType(RULE_KIND_VALUES, { name: 'QualityRuleKind' });
registerEnumType(RULE_SEVERITY_VALUES, { name: 'QualityRuleSeverity' });
registerEnumType(RULE_RESULT_STATUS_VALUES, { name: 'QualityRuleResultStatus' });

@InputType('FilesFilterInput')
export class FilesFilterInput {
  @Field(() => MIME_VALUES, { nullable: true })
  @IsOptional()
  @IsIn(SPREADSHEET_MIME_TYPES)
  mimeType?: SpreadsheetMime;

  @Field(() => FILE_VISIBILITY_VALUES, { nullable: true })
  @IsOptional()
  @IsIn(FILE_VISIBILITIES)
  visibility?: FileVisibility;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  uploaderId?: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  uploadedAfter?: Date;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  @IsDate()
  uploadedBefore?: Date;

  @Field(() => Boolean, { defaultValue: false })
  @IsOptional()
  @IsBoolean()
  allVersions: boolean = false;
}

@ArgsType()
export class FilesConnectionArgs {
  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(50)
  first: number = 20;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  after?: string;

  @Field(() => FILE_SORT_VALUES, { defaultValue: '-createdAt' })
  @IsIn(FILE_SORTS)
  sort: FileSort = '-createdAt';

  @Field(() => FilesFilterInput, { nullable: true })
  @IsOptional()
  filter?: FilesFilterInput;
}

@ObjectType('PageInfo')
export class PageInfoType {
  @Field(() => String, { nullable: true }) nextCursor!: string | null;
  @Field(() => Boolean) hasMore!: boolean;
}

@ObjectType('FileUser')
export class FileUserType {
  @Field(() => ID) id!: string;
  @Field(() => String) fullName!: string;
}

@ObjectType('NumericColumnSummary')
export class NumericColumnSummaryType {
  @Field(() => Float) min!: number;
  @Field(() => Float) max!: number;
  @Field(() => Float) mean!: number;
}

@ObjectType('ColumnQualityMetrics')
export class ColumnQualityMetricsType {
  @Field(() => Int) index!: number;
  @Field(() => String) name!: string;
  @Field(() => Int) nullCount!: number;
  @Field(() => Float) nullPercent!: number;
  @Field(() => COLUMN_TYPE_VALUES) inferredType!: ColumnType;
  @Field(() => Boolean) inconsistent!: boolean;
  @Field(() => Float) inconsistentPercent!: number;
  @Field(() => NumericColumnSummaryType, { nullable: true }) numeric!: NumericColumnSummaryType | null;
}

@ObjectType('DataQualityMetrics')
export class DataQualityMetricsType {
  @Field(() => Int) rowCount!: number;
  @Field(() => Int) columnCount!: number;
  @Field(() => Int) emptyRows!: number;
  @Field(() => Int) duplicateRows!: number;
  @Field(() => Int) raggedRows!: number;
  @Field(() => Boolean) truncated!: boolean;
  @Field(() => Int) rowBudget!: number;
  @Field(() => [String]) headerIssues!: string[];
  @Field(() => [ColumnQualityMetricsType]) columns!: ColumnQualityMetricsType[];
}

@ObjectType('QualityRuleResult')
export class QualityRuleResultType {
  @Field(() => ID) ruleId!: string;
  @Field(() => String) name!: string;
  @Field(() => RULE_KIND_VALUES) kind!: RuleKind;
  @Field(() => String, { nullable: true }) columnName!: string | null;
  @Field(() => RULE_SEVERITY_VALUES) severity!: RuleSeverity;
  @Field(() => RULE_RESULT_STATUS_VALUES) status!: 'passed' | 'failed' | 'skipped';
  @Field(() => String) message!: string;
}

@ObjectType('ReportNarrative')
export class ReportNarrativeType {
  @Field(() => String) summary!: string;
  @Field(() => [String]) recommendations!: string[];
  @Field(() => String) model!: string;
}

@ObjectType('DataQualityReport')
export class DataQualityReportType {
  @Field(() => ID) fileId!: string;
  @Field(() => REPORT_STATUS_VALUES) status!: ReportStatus;
  @Field(() => DataQualityMetricsType, { nullable: true }) metrics!: DataQualityMetricsType | null;
  @Field(() => ReportNarrativeType, { nullable: true }) narrative!: ReportNarrativeType | null;
  @Field(() => String, { nullable: true }) errorMessage!: string | null;
  @Field(() => Date, { nullable: true }) profiledAt!: Date | null;
  @Field(() => Int, { nullable: true }) qualityScore!: number | null;
  @Field(() => [QualityRuleResultType], { nullable: true }) ruleResults!: QualityRuleResultType[] | null;
}

@ObjectType('FileComment')
export class FileCommentType {
  @Field(() => ID) id!: string;
  @Field(() => ID) fileId!: string;
  @Field(() => ID, { nullable: true }) parentId!: string | null;
  @Field(() => String, { nullable: true }) body!: string | null;
  @Field(() => FileUserType) author!: FileUserType;
  @Field(() => [FileUserType]) mentionedUsers!: FileUserType[];
  @Field(() => Date, { nullable: true }) editedAt!: Date | null;
  @Field(() => Date, { nullable: true }) deletedAt!: Date | null;
  @Field(() => Date) createdAt!: Date;
}

@ObjectType('FileCommentConnection')
export class FileCommentConnectionType {
  @Field(() => [FileCommentType]) nodes!: FileCommentType[];
  @Field(() => PageInfoType) pageInfo!: PageInfoType;
}

@ObjectType('File')
export class FileType {
  @Field(() => ID) id!: string;
  @Field(() => ID) datasetId!: string;
  @Field(() => Int) version!: number;
  @Field(() => Boolean) isLatest!: boolean;
  @Field(() => String) originalName!: string;
  @Field(() => String) mimeType!: string;
  @Field(() => Int) sizeBytes!: number;
  @Field(() => FILE_VISIBILITY_VALUES) visibility!: FileVisibility;
  @Field(() => Date) createdAt!: Date;
  @Field(() => Date) updatedAt!: Date;
}

@ObjectType('FileConnection')
export class FileConnectionType {
  @Field(() => [FileType]) nodes!: FileType[];
  @Field(() => PageInfoType) pageInfo!: PageInfoType;
}
