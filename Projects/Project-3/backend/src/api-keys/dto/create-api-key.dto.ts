import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayNotEmpty, ArrayUnique, IsArray, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { API_SCOPES, type ApiScope } from '#/common/auth/require-scopes.decorator.js';

export class CreateApiKeyDto {
  @ApiProperty({
    example: 'Nightly import script',
    minLength: 1,
    maxLength: 80,
    description: 'What the key is for, so you can tell your keys apart and revoke the right one.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({
    enum: API_SCOPES,
    isArray: true,
    example: ['files:read'],
    description:
      'What the key may do. A key can never do more than its creator’s role allows: an employee cannot grant `billing:read`.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(API_SCOPES, { each: true })
  scopes!: ApiScope[];
}
