import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateGiftCardDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'false = deactivate' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
