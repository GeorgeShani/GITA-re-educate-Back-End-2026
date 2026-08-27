import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// Mirrors ProductVariant — attributes stays a free-form map (SCOPE.md A8:
// hand/size/flex/loft/dexterity/colourway/material/compression/pack size
// vary by category, not fixed columns).
export class ProductVariantDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty({ type: Object, example: { hand: 'left', size: '9' } })
  @IsObject()
  attributes!: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Minor units. Omit to inherit basePriceMinor.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceMinor?: number;

  @ApiPropertyOptional({ description: 'Minor units' })
  @IsOptional()
  @IsInt()
  @Min(0)
  compareAtPriceMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  weightGrams?: number;

  @ApiProperty({ default: true })
  @IsBoolean()
  isActive!: boolean;
}
