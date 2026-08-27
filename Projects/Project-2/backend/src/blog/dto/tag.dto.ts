import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TagDto {
  @ApiProperty({ description: 'Unique, lowercased on write' })
  @IsString()
  name!: string;
}
