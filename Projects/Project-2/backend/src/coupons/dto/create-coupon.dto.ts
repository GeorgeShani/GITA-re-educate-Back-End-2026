import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const COUPON_TYPES = ['percentage', 'fixed', 'free_shipping'] as const;

export class CreateCouponDto {
  @ApiProperty({ description: 'Unique, uppercased on write' })
  @IsString()
  code!: string;

  @ApiProperty({ enum: COUPON_TYPES })
  @IsIn(COUPON_TYPES)
  type!: (typeof COUPON_TYPES)[number];

  @ApiProperty({
    description:
      'percentage: 0-100. fixed: minor units. free_shipping: ignored.',
  })
  @IsInt()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ description: 'Minor units', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSpendMinor?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Empty/omitted = applies store-wide',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  perUserLimit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  globalLimit?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  allowStacking?: boolean;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
