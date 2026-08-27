import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PostCategoryDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Unique, lowercased on write' })
  @IsString()
  slug!: string;
}
