import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class PageDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Unique, lowercased on write' })
  @IsString()
  slug!: string;

  @ApiProperty({ description: 'Rich text, as HTML' })
  @IsString()
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  seoDescription?: string;
}
