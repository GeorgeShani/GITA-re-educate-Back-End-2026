import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { RegisterCompanyDto } from '#/auth/dto/register-company.dto.js';
import { SessionDto } from '#/auth/dto/session.dto.js';
import { NormalizedEmail } from '#/common/validation/email.decorator.js';

export class OAuthRegistrationTokenDto {
  @ApiProperty({ description: 'The `oauthRegistration` token from the redirect to `/register`.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  oauthRegistrationToken!: string;
}

/** What the register form prefills from the Google account. */
export class OAuthRegistrationPreviewDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The address to prefill, or null when Google reported a relay/alias address (ask the person for one).',
  })
  @Expose()
  email!: string | null;

  @ApiProperty({ description: 'True when Google vouches for `email`; registration then needs no activation email.' })
  @Expose()
  emailVerified!: boolean;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  name!: string | null;
}

/** The brief's form minus the password — Google is the credential — plus the signed token. */
export class OAuthRegisterCompanyDto extends PickType(RegisterCompanyDto, [
  'companyName',
  'country',
  'industry',
] as const) {
  @ApiProperty({ description: 'The `oauthRegistration` token from the redirect to `/register`.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  oauthRegistrationToken!: string;

  @NormalizedEmail({ optional: true })
  email?: string;
}

export class OAuthRegisterCompanyResponseDto {
  @ApiProperty()
  @Expose()
  companyId!: string;

  @ApiProperty()
  @Expose()
  userId!: string;

  @ApiProperty({ enum: ['pending_activation', 'active'] })
  @Expose()
  status!: 'pending_activation' | 'active';

  @ApiProperty()
  @Expose()
  message!: string;

  @ApiPropertyOptional({
    type: SessionDto,
    nullable: true,
    description: 'Present when Google vouched for the address, so the company is active at once and the person is signed in.',
  })
  @Expose()
  @Type(() => SessionDto)
  session!: SessionDto | null;
}
