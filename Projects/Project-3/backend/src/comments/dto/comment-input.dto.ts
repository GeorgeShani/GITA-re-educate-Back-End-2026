import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ maxLength: 5_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5_000)
  body!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'A top-level comment on the same file.',
  })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 50,
    default: [],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  mentionedUserIds: string[] = [];
}

export class UpdateCommentDto {
  @ApiPropertyOptional({ maxLength: 5_000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5_000)
  body?: string;

  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  mentionedUserIds?: string[];
}
