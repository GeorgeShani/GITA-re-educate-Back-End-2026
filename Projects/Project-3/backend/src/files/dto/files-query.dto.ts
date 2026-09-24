import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsUUID } from 'class-validator';
import { CursorQueryDto } from '#/common/pagination/cursor-query.dto.js';
import { FILE_VISIBILITIES, type FileVisibility } from '../file-asset.entity.js';
import { SPREADSHEET_MIME_TYPES, type SpreadsheetMime } from '../spreadsheet-types.js';

/**
 * Sorting is by upload time only. Keyset pagination needs an ordering the cursor can
 * resume from, and `createdAt` is the one column the list index covers; ordering by
 * name or size would either fall back to `OFFSET` (the cliff keyset exists to avoid)
 * or need an index per column. Newest first is the default.
 */
export const FILE_SORTS = ['-createdAt', 'createdAt'] as const;
export type FileSort = (typeof FILE_SORTS)[number];

export class FilesQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({
    enum: FILE_SORTS,
    default: '-createdAt',
    description: 'A leading `-` is descending.',
  })
  @IsOptional()
  @IsIn(FILE_SORTS)
  sort: FileSort = '-createdAt';

  @ApiPropertyOptional({ enum: SPREADSHEET_MIME_TYPES })
  @IsOptional()
  @IsIn(SPREADSHEET_MIME_TYPES)
  mimeType?: SpreadsheetMime;

  @ApiPropertyOptional({ enum: FILE_VISIBILITIES })
  @IsOptional()
  @IsIn(FILE_VISIBILITIES)
  visibility?: FileVisibility;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  uploaderId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Uploaded at or after this instant.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  uploadedAfter?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Uploaded before this instant.',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  uploadedBefore?: Date;
}
