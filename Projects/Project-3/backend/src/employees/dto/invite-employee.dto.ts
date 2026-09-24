import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizedEmail } from '#/common/validation/email.decorator.js';

export class InviteEmployeeDto {
  @ApiProperty({ description: 'Where the invitation is sent. Also the address they sign in with.' })
  @NormalizedEmail()
  email!: string;

  @ApiProperty({ example: 'Nino Beridze', minLength: 1, maxLength: 120 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;
}
