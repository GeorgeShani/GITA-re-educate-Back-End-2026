import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';

export class CheckoutQuoteDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-2' })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;
}
