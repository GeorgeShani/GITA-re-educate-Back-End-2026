import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsString, Min } from 'class-validator';

export class AddCartItemDto {
  @ApiProperty()
  @IsMongoId()
  productId!: string;

  @ApiProperty()
  @IsString()
  variantSku!: string;

  @ApiProperty({ minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}
