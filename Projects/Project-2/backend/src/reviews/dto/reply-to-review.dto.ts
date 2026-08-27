import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyToReviewDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reply!: string;
}
