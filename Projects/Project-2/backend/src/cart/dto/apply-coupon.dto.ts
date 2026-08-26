import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ApplyCouponDto {
  @ApiProperty()
  @IsString()
  code!: string;
}
