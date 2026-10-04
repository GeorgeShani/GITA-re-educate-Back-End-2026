import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RebuildReportDto {
  @ApiPropertyOptional({
    description:
      'For a workbook with several worksheets: the one to profile. It must be one of the sheets the report names (`metrics.sheet`). Omit to keep the sheet already chosen.',
    example: 'Sales',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  sheet?: string;
}
