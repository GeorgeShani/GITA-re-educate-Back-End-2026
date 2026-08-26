import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const MAX_REVIEW_PHOTOS = 6;

export class CreateReviewDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({
    description: 'Cloudinary public_ids from S6 uploads',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REVIEW_PHOTOS)
  @IsString({ each: true })
  photoPublicIds?: string[];
}
