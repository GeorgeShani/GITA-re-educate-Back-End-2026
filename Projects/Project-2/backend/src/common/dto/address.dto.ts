import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

// Mirrors common/schemas/address.schema.ts's shape — that class is a
// Mongoose subdocument schema, not request-input validated, so this is
// the separate DTO checkout (S9) and account address management (S10)
// both validate against.
export class AddressDto {
  @ApiProperty()
  @IsString()
  fullName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  company?: string;

  @ApiProperty()
  @IsString()
  line1!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty()
  @IsString()
  city!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  region?: string;

  @ApiProperty()
  @IsString()
  postalCode!: string;

  @ApiProperty({ description: 'ISO 3166-1 alpha-2' })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
