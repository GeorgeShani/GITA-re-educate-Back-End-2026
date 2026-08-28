import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import type { ReviewStatus } from '@/reviews/schemas/review.schema';

const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;

export class FindReviewsAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: REVIEW_STATUSES })
  @IsOptional()
  @IsIn(REVIEW_STATUSES)
  status?: ReviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  productId?: string;
}
