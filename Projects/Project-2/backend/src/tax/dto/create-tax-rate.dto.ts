import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateTaxRateDto {
  @ApiProperty({ description: 'ISO 3166-1 alpha-2' })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiPropertyOptional({
    description: 'State/province, if sub-nationally taxed',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty({ description: 'Basis points — e.g. 825 = 8.25%' })
  @IsInt()
  @Min(0)
  rateBasisPoints!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
