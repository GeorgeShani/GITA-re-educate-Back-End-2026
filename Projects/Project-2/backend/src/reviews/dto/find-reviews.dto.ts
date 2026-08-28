import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class FindReviewsDto extends PaginationQueryDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;
}
