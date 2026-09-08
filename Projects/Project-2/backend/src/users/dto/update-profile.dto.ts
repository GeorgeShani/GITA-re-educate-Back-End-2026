import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  // Set after the client's own direct-to-Cloudinary upload + POST /media
  // (ownerContext 'avatar') round trip — same two-step attach pattern
  // AdminMediaController documents for product images: register the
  // asset, then a separate PATCH on the owning resource points at it.
  @ApiPropertyOptional({
    description:
      'A Cloudinary secure_url from POST /media (ownerContext: avatar)',
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
