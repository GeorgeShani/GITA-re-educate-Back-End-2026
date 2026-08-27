import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetUserBannedDto {
  @ApiProperty()
  @IsBoolean()
  banned!: boolean;
}
