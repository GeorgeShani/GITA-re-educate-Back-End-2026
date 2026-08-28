import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';

export class FindProductsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Free-text search — routes through Atlas Search',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ description: 'Minor units' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Minor units' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFeatured?: boolean;

  // Shadows PaginationQueryDto's generic `sort?: string` with a closed
  // set of the fields this endpoint actually supports. `declare` — no
  // separate field initializer, just a narrower type for this class;
  // the decorators below still apply to the property key regardless.
  @ApiPropertyOptional({ enum: ['price', 'newest', 'rating', 'popularity'] })
  @IsOptional()
  @IsIn(['price', 'newest', 'rating', 'popularity'])
  declare sort?: 'price' | 'newest' | 'rating' | 'popularity';
}
