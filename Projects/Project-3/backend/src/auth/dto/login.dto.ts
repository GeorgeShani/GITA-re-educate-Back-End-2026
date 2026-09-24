import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { NormalizedEmail } from '#/common/validation/email.decorator.js';
import { MAX_PASSWORD_LENGTH } from '#/auth/crypto/password-hasher.js';

export class LoginDto {
  @NormalizedEmail()
  email!: string;

  /** No minimum on login: an old account may predate the current policy. */
  @ApiProperty({ maxLength: MAX_PASSWORD_LENGTH })
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password!: string;
}
