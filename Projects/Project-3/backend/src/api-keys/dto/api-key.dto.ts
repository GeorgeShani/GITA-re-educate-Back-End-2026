import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { OffsetPageOf } from '#/common/pagination/offset-page.dto.js';
import { toDto } from '#/common/response/to-dto.js';
import { API_SCOPES, type ApiScope } from '#/common/auth/require-scopes.decorator.js';
import type { ApiKey } from '../api-key.entity.js';

/** A key as it is listed. The secret is not here and cannot be recovered: only its hash is stored. */
export class ApiKeyDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  name!: string;

  @ApiProperty({ example: 'gl_live_ab12cd34', description: 'The first part of the key. Not a secret.' })
  @Expose()
  prefix!: string;

  @ApiProperty({ enum: API_SCOPES, isArray: true })
  @Expose()
  scopes!: ApiScope[];

  @ApiProperty({ description: 'Whose key this is. Requests made with it act as this person.' })
  @Expose()
  createdByUserId!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Approximate: refreshed at most every five minutes.',
  })
  @Expose()
  lastUsedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'Set once revoked.' })
  @Expose()
  revokedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  @Expose()
  createdAt!: Date;

  static from(key: ApiKey): ApiKeyDto {
    return toDto(ApiKeyDto, key);
  }
}

export class CreatedApiKeyDto extends ApiKeyDto {
  @ApiProperty({
    example: 'gl_live_ab12cd34_<43 characters>',
    description: 'The full key. Shown ONCE, here; store it now. Send it as `Authorization: Bearer <key>`.',
  })
  @Expose()
  key!: string;

  static fromCreated(key: ApiKey, plaintext: string): CreatedApiKeyDto {
    return toDto(CreatedApiKeyDto, { ...key, key: plaintext });
  }
}

export class ApiKeyPageDto extends OffsetPageOf(ApiKeyDto) {}
