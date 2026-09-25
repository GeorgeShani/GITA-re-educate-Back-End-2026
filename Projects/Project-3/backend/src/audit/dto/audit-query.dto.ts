import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CursorQueryDto } from '#/common/pagination/cursor-query.dto.js';
import { AUDIT_ACTIONS, type AuditAction } from '#/core/audit/audit-actions.js';

/** Newest first, always: an audit log is read backwards from "what just happened". */
export class AuditQueryDto extends CursorQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: AuditAction;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only what this person did.' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ example: 'file', description: 'The kind of thing acted on.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  targetType?: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'At or after this instant.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', description: 'Before this instant.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
