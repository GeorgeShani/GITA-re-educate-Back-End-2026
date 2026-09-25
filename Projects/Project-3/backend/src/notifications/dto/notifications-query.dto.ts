import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CursorQueryDto } from '#/common/pagination/cursor-query.dto.js';

/** `?unread=true|false`. Query strings are text, and `Boolean('false')` is true, so this is spelled out. */
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Newest first, always. */
export class NotificationsQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ type: Boolean, description: 'Only notifications you have not read yet.' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;
}
