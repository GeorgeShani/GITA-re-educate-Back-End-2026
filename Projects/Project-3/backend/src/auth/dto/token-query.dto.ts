import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** `?token=` on the activation link. */
export class TokenQueryDto {
  @ApiProperty({ description: 'The single-use token from the emailed link.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;
}
