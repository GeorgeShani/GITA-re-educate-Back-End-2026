import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';

import { AddressDto } from '../../common/dto/address.dto';

export class PlaceOrderDto {
  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  shippingAddress!: AddressDto;

  @ApiProperty({ type: AddressDto })
  @ValidateNested()
  @Type(() => AddressDto)
  billingAddress!: AddressDto;

  @ApiProperty({
    description: 'One of the method names from GET /checkout/quote',
  })
  @IsString()
  shippingMethod!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerNote?: string;
}
