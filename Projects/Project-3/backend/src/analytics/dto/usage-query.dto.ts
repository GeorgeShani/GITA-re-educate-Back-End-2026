import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional } from 'class-validator';

/**
 * Both ends are read as UTC DAYS (any time of day is dropped) and `to` is exclusive.
 * With neither, the range is the current billing period so far.
 */
export class UsageQueryDto {
  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-03-01', description: 'First day, inclusive. Default: the first day of the current billing period.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @ApiPropertyOptional({ type: String, format: 'date', example: '2026-04-01', description: 'Last day, exclusive. Default: through today. At most 366 days after `from`.' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
