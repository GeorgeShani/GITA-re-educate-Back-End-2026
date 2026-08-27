import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class AddSuppressionDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}
