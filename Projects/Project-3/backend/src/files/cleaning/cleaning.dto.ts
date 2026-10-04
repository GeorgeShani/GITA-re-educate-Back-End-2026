import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { STEP_KINDS } from './recipe.js';
import { CLEANING_JOB_STATUSES, type CleaningJobStatus } from './cleaning-job.entity.js';

const RECIPE_DOC =
  'The steps, in order: `{ "steps": [ { "step": "trim_whitespace" }, { "step": "standardise_dates", "column": "when", "order": "dmy" } ] }`. ' +
  `Steps: ${STEP_KINDS.map((kind) => `\`${kind}\``).join(', ')}. A step about a column the file does not have is skipped, not refused.`;

export class CleanPreviewDto {
  @ApiProperty({ type: 'object', additionalProperties: true, description: RECIPE_DOC })
  @IsObject()
  recipe!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'For a workbook with several sheets: the one to clean. Omit for the sheet the report covers.',
    example: 'Sales',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sheet?: string;
}

export class CleanFileDto extends CleanPreviewDto {
  @ApiPropertyOptional({ description: 'Keep this recipe for the file (its dataset), so it is offered again next time.', default: false })
  @IsOptional()
  @IsBoolean()
  saveRecipe?: boolean;

  @ApiPropertyOptional({
    description:
      'Clean every NEW version of this dataset with this recipe, keeping each upload as it arrived and adding the cleaned data after it. ' +
      'Needs `saveRecipe`, and a Basic or Premium plan.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoClean?: boolean;
}

export class StepOutcomeDto {
  @ApiProperty({ enum: STEP_KINDS }) @Expose() step!: string;
  @ApiProperty({ description: 'The step in words, e.g. "Trim spaces in Name".' }) @Expose() label!: string;
  @ApiProperty({ description: 'Cells changed (or rows or columns removed, for the steps that do that).' }) @Expose() changed!: number;
  @ApiProperty({ type: String, nullable: true, description: 'Why the step did nothing, when it did not apply.' }) @Expose() skipped!: string | null;
  @ApiProperty({ type: [String], description: 'Things worth saying, e.g. values that could not be read as dates.' }) @Expose() notes!: string[];
}

export class SampleCellDto {
  @ApiProperty({ type: String, nullable: true }) @Expose() before!: string | null;
  @ApiProperty({ type: String, nullable: true }) @Expose() after!: string | null;
}

export class SampleRowDto {
  @ApiProperty({ description: 'The row\'s number in the file as uploaded, counting the header as row 1.' }) @Expose() row!: number;
  @ApiProperty({ type: () => [SampleCellDto], description: 'One per column of the cleaned file, in order.' })
  @Expose()
  @Type(() => SampleCellDto)
  cells!: SampleCellDto[];
}

export class CleanPreviewResultDto {
  @ApiProperty() @Expose() rowsBefore!: number;
  @ApiProperty() @Expose() rowsAfter!: number;
  @ApiProperty({ type: [String], description: 'The columns the cleaned file would have.' }) @Expose() columns!: string[];
  @ApiProperty({ type: () => [StepOutcomeDto], description: 'What each step did, counted over the WHOLE file.' })
  @Expose()
  @Type(() => StepOutcomeDto)
  steps!: StepOutcomeDto[];
  @ApiProperty({ type: () => [SampleRowDto], description: 'The first rows the steps change, each cell before and after.' })
  @Expose()
  @Type(() => SampleRowDto)
  samples!: SampleRowDto[];
}

export class CleaningJobDto {
  @ApiProperty() @Expose() id!: string;
  @ApiProperty() @Expose() fileId!: string;
  @ApiProperty({ enum: CLEANING_JOB_STATUSES }) @Expose() status!: CleaningJobStatus;
  @ApiProperty({ enum: ['manual', 'auto'], description: '`auto` when a dataset\'s "clean every new version" setting started it.' }) @Expose() trigger!: string;
  @ApiProperty({ type: String, nullable: true, description: 'The new version, once it exists.' }) @Expose() resultFileId!: string | null;
  @ApiProperty({ type: String, nullable: true }) @Expose() errorMessage!: string | null;
  @ApiProperty({ type: () => [StepOutcomeDto], description: 'What each step did; empty until the job has run.' })
  @Expose()
  @Type(() => StepOutcomeDto)
  steps!: StepOutcomeDto[];
  @ApiProperty({ type: Number, nullable: true }) @Expose() rowsBefore!: number | null;
  @ApiProperty({ type: Number, nullable: true }) @Expose() rowsAfter!: number | null;
  @ApiProperty({ type: String, format: 'date-time' }) @Expose() createdAt!: Date;
}

export class DatasetSettingsDto {
  @ApiProperty() @Expose() datasetId!: string;
  @ApiProperty({ type: [String], description: 'The columns that together identify a row, for comparing two versions row by row.' }) @Expose() keyColumns!: string[];
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true, description: 'The saved cleaning recipe, or null.' }) @Expose() recipe!: Record<string, unknown> | null;
  @ApiProperty({ description: 'Every new version is cleaned with the saved recipe.' }) @Expose() autoClean!: boolean;
  @ApiProperty({ description: 'Whether this company\'s plan includes automatic cleaning.' }) @Expose() autoCleanAvailable!: boolean;
}

export class UpdateDatasetSettingsDto {
  @ApiPropertyOptional({ type: [String], description: 'REPLACES the key columns.' })
  @IsOptional()
  keyColumns?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, nullable: true, description: 'The cleaning recipe to keep; `null` removes it (and switches automatic cleaning off).' })
  @IsOptional()
  recipe?: Record<string, unknown> | null;

  @ApiPropertyOptional({ description: 'Clean every new version automatically. Needs a saved recipe, and a Basic or Premium plan.' })
  @IsOptional()
  @IsBoolean()
  autoClean?: boolean;
}
