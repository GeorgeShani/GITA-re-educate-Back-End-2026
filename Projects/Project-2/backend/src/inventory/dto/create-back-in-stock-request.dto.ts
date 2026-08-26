import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsMongoId, IsOptional, IsString } from 'class-validator';

export class CreateBackInStockRequestDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantSku?: string;

  @ApiProperty()
  @IsEmail()
  email!: string;
}
