import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreatePostDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Unique, lowercased on write' })
  @IsString()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  excerpt?: string;

  @ApiProperty({ description: 'Rich text, as HTML' })
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  tagIds?: string[];

  @ApiPropertyOptional({
    description: 'true = publish immediately, false/omitted = draft',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string;
}
