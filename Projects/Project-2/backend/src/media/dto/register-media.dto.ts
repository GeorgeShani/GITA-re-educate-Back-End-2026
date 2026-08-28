import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

import { MEDIA_OWNER_CONTEXTS } from '@/media/media-owner-context';
import type { MediaOwnerContext } from '@/media/media-owner-context';

export class RegisterMediaDto {
  @ApiProperty({
    description:
      "The public_id Cloudinary returned after the client's direct upload",
  })
  @IsString()
  publicId!: string;

  @ApiProperty({ enum: MEDIA_OWNER_CONTEXTS })
  @IsIn(MEDIA_OWNER_CONTEXTS)
  ownerContext!: MediaOwnerContext;
}
