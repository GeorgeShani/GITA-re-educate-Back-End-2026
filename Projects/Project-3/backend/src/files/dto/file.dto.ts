import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { CursorPageOf } from '#/common/pagination/cursor-page.dto.js';
import { OffsetPageOf } from '#/common/pagination/offset-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { FILE_VISIBILITIES, type FileAsset, type FileVisibility } from '../file-asset.entity.js';

/**
 * A file as the API shows it. There is no `storageKey`: where the bytes live is an
 * implementation detail, and the only way to them is `GET /files/:id/download`.
 */
export class FileDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  originalName!: string;

  @ApiProperty({ description: "From the file's bytes, not from what the client claimed." })
  @Expose()
  mimeType!: string;

  @ApiProperty()
  @Expose()
  sizeBytes!: number;

  @ApiProperty({ enum: FILE_VISIBILITIES })
  @Expose()
  visibility!: FileVisibility;

  @ApiProperty({
    format: 'uuid',
    description: "Shared by every version of one file. A first upload's is its own `id`.",
  })
  @Expose()
  datasetId!: string;

  @ApiProperty({ description: 'Which version of the file this is: 1, 2, 3… Numbers are never reused.' })
  @Expose()
  version!: number;

  @ApiProperty({ description: 'The newest version. A default list shows only these.' })
  @Expose()
  isLatest!: boolean;

  @ApiProperty()
  @Expose()
  uploaderId!: string;

  @ApiProperty({
    type: [String],
    nullable: true,
    description:
      'Who a restricted file is shared with. Shown only to the uploader and admins, and only on single-file responses; null everywhere else.',
  })
  @Expose()
  grantedUserIds!: string[] | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  static from(file: FileAsset, grantedUserIds: string[] | null = null): FileDto {
    return toDto(FileDto, { ...file, grantedUserIds });
  }
}

export class FilePageDto extends CursorPageOf(FileDto) {}

export class FileVersionPageDto extends OffsetPageOf(FileDto) {}

export class FileDownloadDto {
  @ApiProperty({
    description: 'A short-lived link. Fetch it directly; it needs no Authorization header.',
  })
  @Expose()
  url!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'The link stops working at this instant.',
  })
  @Expose()
  expiresAt!: Date;
}
