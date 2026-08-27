import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveReturnDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminNote?: string;
}
