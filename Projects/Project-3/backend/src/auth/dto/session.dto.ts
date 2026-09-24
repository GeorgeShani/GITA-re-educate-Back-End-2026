import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/**
 * Returned by login, refresh, and password change. The Next.js BFF turns these
 * into httpOnly cookies; no token ever needs to touch browser JavaScript.
 */
export class SessionDto {
  @ApiProperty({ description: 'Short-lived JWT. Send as `Authorization: Bearer`.' })
  @Expose()
  accessToken!: string;

  @ApiProperty({ description: 'Opaque, single-use. Rotated on every refresh.' })
  @Expose()
  refreshToken!: string;

  @ApiProperty({ example: 'Bearer' })
  @Expose()
  tokenType!: 'Bearer';

  @ApiProperty({ description: 'Seconds until the access token expires.', example: 900 })
  @Expose()
  expiresIn!: number;
}
