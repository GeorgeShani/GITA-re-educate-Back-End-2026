import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { CursorPageOf } from '#/common/pagination/cursor-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import type { CommentView } from '../comments.service.js';

export class CommentUserDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  fullName!: string;
}

export class CommentDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  fileId!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  @Expose()
  parentId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Null for a deleted tombstone.',
  })
  @Expose()
  body!: string | null;

  @ApiProperty({ type: () => CommentUserDto })
  @Expose()
  @Type(() => CommentUserDto)
  author!: CommentUserDto;

  @ApiProperty({ type: [CommentUserDto] })
  @Expose()
  @Type(() => CommentUserDto)
  mentionedUsers!: CommentUserDto[];

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  editedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  @Expose()
  deletedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  static from(view: CommentView): CommentDto {
    return toDto(CommentDto, view);
  }
}

export class CommentPageDto extends CursorPageOf(CommentDto) {}
