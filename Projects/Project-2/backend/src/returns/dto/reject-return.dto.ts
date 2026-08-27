import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RejectReturnDto {
  @ApiProperty({ description: 'Why the return is being rejected' })
  @IsString()
  @IsNotEmpty()
  adminNote!: string;
}
