import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

/** For routes whose whole answer is "it worked" — and for routes that deliberately say nothing more. */
export class MessageResponseDto {
  @ApiProperty({ example: 'If that account exists, an email is on its way.' })
  @Expose()
  message!: string;
}
