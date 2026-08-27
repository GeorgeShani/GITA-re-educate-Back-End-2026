import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

import { CreatePostDto } from './create-post.dto';

// publishedAt is carved out of CreatePostDto before PartialType applies
// (OmitType, then re-added below) — PartialType alone can't widen a
// field's type, and CreatePostDto's `publishedAt?: string` doesn't
// accept the explicit `null` this DTO needs for "revert to draft".
export class UpdatePostDto extends PartialType(
  OmitType(CreatePostDto, ['publishedAt'] as const),
) {
  @ApiPropertyOptional({
    description:
      'ISO 8601 to (re)publish/schedule, null to revert to draft, omit to leave untouched.',
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string | null;
}
