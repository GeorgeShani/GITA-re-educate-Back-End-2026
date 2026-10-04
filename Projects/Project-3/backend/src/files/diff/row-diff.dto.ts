import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { VERSION_DIFF_STATUSES, type VersionDiffStatus } from './version-diff.entity.js';

export class RowDiffRequestDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'The columns that together identify a row (up to 10), so a row in one version can be matched with the same row in the other. ' +
      'Omit to use the ones saved for the dataset (`PUT /datasets/{datasetId}/settings`).',
    example: ['customer_id'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(200, { each: true })
  keyColumns?: string[];
}

export class ChangedCellDto {
  @ApiProperty()
  @Expose()
  column!: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  before!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  after!: string | null;
}

export class RowChangeDto {
  @ApiProperty({ enum: ['added', 'removed', 'changed'] })
  @Expose()
  change!: 'added' | 'removed' | 'changed';

  @ApiProperty({ type: [String], description: 'The values of the key columns, in the order of `keyColumns`.' })
  @Expose()
  key!: string[];

  @ApiProperty({ type: [ChangedCellDto], description: 'For a changed row only the cells that differ; for an added or removed row every cell.' })
  @Expose()
  @Type(() => ChangedCellDto)
  cells!: ChangedCellDto[];
}

export class ColumnChangeCountDto {
  @ApiProperty()
  @Expose()
  column!: string;

  @ApiProperty()
  @Expose()
  changed!: number;
}

export class RowDiffSummaryDto {
  @ApiProperty({ type: [String] })
  @Expose()
  keyColumns!: string[];

  @ApiProperty()
  @Expose()
  rowsBefore!: number;

  @ApiProperty()
  @Expose()
  rowsAfter!: number;

  @ApiProperty()
  @Expose()
  added!: number;

  @ApiProperty()
  @Expose()
  removed!: number;

  @ApiProperty()
  @Expose()
  changed!: number;

  @ApiProperty()
  @Expose()
  unchanged!: number;

  @ApiProperty({ description: 'Rows with an empty key, or a key that appears more than once, in either version. They cannot be matched and are not counted above.' })
  @Expose()
  unmatchable!: number;

  @ApiProperty({ type: [ColumnChangeCountDto], description: 'Columns in both versions, with how many rows changed in each, most first.' })
  @Expose()
  @Type(() => ColumnChangeCountDto)
  columnsChanged!: ColumnChangeCountDto[];

  @ApiProperty({ type: [String] })
  @Expose()
  columnsAdded!: string[];

  @ApiProperty({ type: [String] })
  @Expose()
  columnsRemoved!: string[];
}

export class RowDiffVersionDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  fileId!: string;

  @ApiProperty()
  @Expose()
  version!: number;

  @ApiProperty()
  @Expose()
  originalName!: string;
}

export class RowDiffDto {
  @ApiProperty({ type: RowDiffVersionDto })
  @Expose()
  @Type(() => RowDiffVersionDto)
  from!: RowDiffVersionDto;

  @ApiProperty({ type: RowDiffVersionDto })
  @Expose()
  @Type(() => RowDiffVersionDto)
  to!: RowDiffVersionDto;

  @ApiProperty({
    enum: [...VERSION_DIFF_STATUSES, 'none'],
    description: '`none` until a comparison has been asked for (or made automatically).',
  })
  @Expose()
  status!: VersionDiffStatus | 'none';

  @ApiProperty({ type: [String], description: 'The columns the comparison used or, before one is made, those saved for the dataset.' })
  @Expose()
  keyColumns!: string[];

  @ApiProperty({ type: [String], description: 'Columns whose names say they identify a row, found in both versions: a suggestion to confirm.' })
  @Expose()
  suggestedKeyColumns!: string[];

  @ApiProperty({ type: RowDiffSummaryDto, nullable: true })
  @Expose()
  @Type(() => RowDiffSummaryDto)
  summary!: RowDiffSummaryDto | null;

  @ApiProperty({ type: [RowChangeDto], description: 'The first 500 changes: rows removed, then added, then changed. All of them are in the CSV.' })
  @Expose()
  @Type(() => RowChangeDto)
  sample!: RowChangeDto[];

  @ApiProperty({ type: String, nullable: true, description: 'Why a comparison could not be made.' })
  @Expose()
  errorMessage!: string | null;
}
