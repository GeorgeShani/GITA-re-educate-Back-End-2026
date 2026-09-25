import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { toBoolean } from '#/common/http/query-boolean.js';
import { CursorQueryDto } from '#/common/pagination/cursor-query.dto.js';

/** Newest first, always. */
export class NotificationsQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Only notifications you have not read yet.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;
}
