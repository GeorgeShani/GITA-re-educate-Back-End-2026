import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class FindAuditLogDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Exact event name, e.g. "order.shipped"',
  })
  @IsOptional()
  @IsString()
  eventName?: string;

  @ApiPropertyOptional({ description: 'e.g. "Order", "Return", "Product"' })
  @IsOptional()
  @IsString()
  aggregateType?: string;

  @ApiPropertyOptional({ description: 'The affected entity id' })
  @IsOptional()
  @IsString()
  aggregateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  correlationId?: string;
}
