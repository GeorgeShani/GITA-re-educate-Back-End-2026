import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';
import { FILE_VISIBILITIES, type FileVisibility } from '../file-asset.entity.js';
import { ToGrantIdList } from './grant-ids.transform.js';

/** The text fields of the multipart body; the file itself arrives as the `file` part. */
export class UploadFileDto {
  @ApiPropertyOptional({ enum: FILE_VISIBILITIES, default: 'company' })
  @IsOptional()
  @IsIn(FILE_VISIBILITIES)
  visibility: FileVisibility = 'company';

  @ApiPropertyOptional({
    type: [String],
    description:
      'With `restricted`: the colleagues who may also see the file (the uploader and admins always can). Repeat the field, or send a JSON array. Empty means the uploader and admins only.',
  })
  @IsOptional()
  @ToGrantIdList()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  grantedUserIds?: string[];
}

/**
 * The text fields of a new-VERSION upload: none. A version inherits the visibility and grants of the
 * file's current latest version, so the global `forbidNonWhitelisted` rejects any field sent with it.
 */
export class UploadVersionDto {}

/** Documents the multipart shape of a new version in OpenAPI; never instantiated. */
export class UploadVersionBodyDoc extends UploadVersionDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'A CSV, XLS or XLSX file, up to 25 MB.' })
  file!: unknown;
}

/** Documents the multipart shape in OpenAPI; never instantiated. */
export class UploadFileBodyDoc extends UploadFileDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'A CSV, XLS or XLSX file, up to 25 MB.' })
  file!: unknown;
}
