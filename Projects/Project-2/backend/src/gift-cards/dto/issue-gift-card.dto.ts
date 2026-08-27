import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  Min,
} from 'class-validator';

export class IssueGiftCardDto {
  @ApiProperty({ description: 'Minor units' })
  @IsInt()
  @Min(1)
  balanceMinor!: number;

  @ApiPropertyOptional({
    description: 'Owner, if issued to a specific customer',
  })
  @IsOptional()
  @IsMongoId()
  issuedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
