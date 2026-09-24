import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { toDto } from '#/common/response/to-dto.js';
import { AUTH_PROVIDERS, type AuthProvider, type AuthIdentity } from '#/database/entities/auth-identity.entity.js';

/** How someone proves who they are. Never carries a hash or the provider's subject. */
export class IdentityDto {
  @ApiProperty()
  @Expose()
  id!: string;

  @ApiProperty({ enum: AUTH_PROVIDERS })
  @Expose()
  provider!: AuthProvider;

  @ApiProperty({ type: String, nullable: true, description: 'The address as that provider reports it; may differ from the work address.' })
  @Expose()
  email!: string | null;

  @ApiProperty()
  @Expose()
  emailVerified!: boolean;

  @ApiProperty({ type: Date, nullable: true })
  @Expose()
  lastUsedAt!: Date | null;

  @ApiProperty({ type: Date })
  @Expose()
  createdAt!: Date;

  static from(identity: AuthIdentity): IdentityDto {
    return toDto(IdentityDto, identity);
  }
}

export class IdentityListDto {
  @ApiProperty({ type: [IdentityDto] })
  @Expose()
  @Type(() => IdentityDto)
  data!: IdentityDto[];
}
