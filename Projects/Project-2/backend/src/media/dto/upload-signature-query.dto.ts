import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { MEDIA_OWNER_CONTEXTS } from '../media-owner-context';
import type { MediaOwnerContext } from '../media-owner-context';

export class UploadSignatureQueryDto {
  @ApiProperty({ enum: MEDIA_OWNER_CONTEXTS })
  @IsIn(MEDIA_OWNER_CONTEXTS)
  ownerContext!: MediaOwnerContext;
}
