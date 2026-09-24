import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import {
  COMPANY_INDUSTRIES,
  type CompanyIndustry,
} from '#/database/entities/company.entity.js';
import { NormalizedEmail } from '#/common/validation/email.decorator.js';

/** Every field optional — a PATCH changes only what it names. */
export class UpdateCompanyDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: 'GE', description: 'ISO 3166-1 alpha-2 country code' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'country must be a two-letter ISO 3166-1 code' })
  country?: string;

  @ApiPropertyOptional({ enum: COMPANY_INDUSTRIES })
  @IsOptional()
  @IsIn(COMPANY_INDUSTRIES)
  industry?: CompanyIndustry;

  @NormalizedEmail({ optional: true })
  billingEmail?: string;
}
