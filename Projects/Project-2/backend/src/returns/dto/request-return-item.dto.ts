import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsMongoId, IsString, Min, MinLength } from 'class-validator';

export class RequestReturnItemDto {
  @ApiProperty({ description: "The order line's own _id (Order.items[].id)" })
  @IsMongoId()
  orderItemId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  reason!: string;
}
