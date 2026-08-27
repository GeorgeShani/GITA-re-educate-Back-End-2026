import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';

import { ShippingRateDto } from './shipping-rate.dto';

export class CreateShippingZoneDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ type: [String], description: 'ISO 3166-1 alpha-2' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Length(2, 2, { each: true })
  countryCodes!: string[];

  @ApiPropertyOptional({ type: [ShippingRateDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ShippingRateDto)
  rates?: ShippingRateDto[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
