import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class SubmitCommentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  authorName!: string;

  @ApiProperty()
  @IsEmail()
  authorEmail!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  body!: string;

  @ApiPropertyOptional({ description: 'Set to reply to another comment' })
  @IsOptional()
  @IsMongoId()
  parentId?: string;
}
