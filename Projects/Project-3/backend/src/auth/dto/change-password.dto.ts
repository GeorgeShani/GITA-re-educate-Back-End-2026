import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { MIN_PASSWORD_LENGTH } from '../auth.constants.js';
import { MAX_PASSWORD_LENGTH } from '../crypto/password-hasher.js';

export class ChangePasswordDto {
  @ApiProperty({ maxLength: MAX_PASSWORD_LENGTH })
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword!: string;

  @ApiProperty({ minLength: MIN_PASSWORD_LENGTH, maxLength: MAX_PASSWORD_LENGTH })
  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH)
  @MaxLength(MAX_PASSWORD_LENGTH)
  newPassword!: string;
}
