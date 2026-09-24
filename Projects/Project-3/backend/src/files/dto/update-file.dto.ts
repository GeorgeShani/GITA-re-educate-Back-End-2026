import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';
import { FILE_VISIBILITIES, type FileVisibility } from '../file-asset.entity.js';

/** At least one field is required; the service rejects an empty body. */
export class UpdateFileDto {
  @ApiPropertyOptional({ enum: FILE_VISIBILITIES })
  @IsOptional()
  @IsIn(FILE_VISIBILITIES)
  visibility?: FileVisibility;

  @ApiPropertyOptional({
    type: [String],
    description:
      'REPLACES the set of colleagues granted access. Only meaningful for a `restricted` file; switching to `company` clears it.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  grantedUserIds?: string[];
}
