import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({ description: 'Positive = restock, negative = decrement' })
  @IsInt()
  delta!: number;

  @ApiProperty({ example: 'manual_correction' })
  @IsString()
  @IsNotEmpty()
  reasonCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
