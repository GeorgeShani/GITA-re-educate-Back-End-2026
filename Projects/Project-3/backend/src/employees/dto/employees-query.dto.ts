import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import {
  USER_ROLES,
  USER_STATUSES,
  type UserRole,
  type UserStatus,
} from '#/database/entities/user.entity.js';

/**
 * The filter-DTO convention, first instance: one typed DTO per resource,
 * validated by the global pipe and translated into conditional `andWhere`
 * calls. A filter only ever narrows what `TenantScope` already allows.
 */
export class EmployeesQueryDto extends OffsetQueryDto {
  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;
}
