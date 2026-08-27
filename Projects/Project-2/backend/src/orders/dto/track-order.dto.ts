import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class TrackOrderDto {
  @ApiProperty()
  @IsString()
  orderNumber!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;
}
