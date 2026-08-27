import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional } from 'class-validator';

export class DashboardSummaryQueryDto {
  @ApiPropertyOptional({
    description: 'ISO 8601 date. Defaults to 30 days before `to`.',
  })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 date. Defaults to now.' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
