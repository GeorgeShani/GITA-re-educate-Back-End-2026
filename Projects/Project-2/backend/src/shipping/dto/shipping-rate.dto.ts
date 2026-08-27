import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ShippingRateDto {
  @ApiProperty({ example: 'Standard' })
  @IsString()
  method!: string;

  @ApiProperty({ description: 'Minor units' })
  @IsInt()
  @Min(0)
  priceMinor!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  minWeightGrams?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  maxWeightGrams?: number;

  @ApiPropertyOptional({
    description:
      'Order subtotal at/above this waives the rate. 0 = always free.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  freeAboveSubtotalMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDaysMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDaysMax?: number;
}
