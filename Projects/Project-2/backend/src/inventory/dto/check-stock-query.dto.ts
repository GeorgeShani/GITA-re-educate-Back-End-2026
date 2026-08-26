import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsString } from 'class-validator';

export class CheckStockQueryDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty()
  @IsString()
  variantSku!: string;
}
