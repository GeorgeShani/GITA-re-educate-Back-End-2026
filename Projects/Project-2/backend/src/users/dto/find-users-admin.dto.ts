import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class FindUsersAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive partial match' })
  @IsOptional()
  @IsString()
  email?: string;
}
