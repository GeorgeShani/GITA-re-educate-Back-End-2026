import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import type { CommentStatus } from '../schemas/comment.schema';

const COMMENT_STATUSES = ['pending', 'approved', 'rejected'] as const;

export class FindCommentsAdminDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: COMMENT_STATUSES })
  @IsOptional()
  @IsIn(COMMENT_STATUSES)
  status?: CommentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  postId?: string;
}
