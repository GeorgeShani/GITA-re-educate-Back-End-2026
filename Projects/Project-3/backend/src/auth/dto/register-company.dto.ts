import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail } from '../../common/validation/email.decorator.js';
import {
  COMPANY_INDUSTRIES,
  type CompanyIndustry,
} from '../../database/entities/company.entity.js';
import { MIN_PASSWORD_LENGTH } from '../auth.constants.js';
import { MAX_PASSWORD_LENGTH } from '../crypto/password-hasher.js';

/** Exactly the brief's five fields. */
export class RegisterCompanyDto {
  @ApiProperty({ example: 'Acme Logistics', minLength: 2, maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @NormalizedEmail()
  email!: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH, maxLength: MAX_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;

  @ApiProperty({ example: 'GE', description: 'ISO 3166-1 alpha-2 country code' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'country must be a two-letter ISO 3166-1 code' })
  country!: string;

  @ApiProperty({ enum: COMPANY_INDUSTRIES })
  @IsIn(COMPANY_INDUSTRIES)
  industry!: CompanyIndustry;
}
