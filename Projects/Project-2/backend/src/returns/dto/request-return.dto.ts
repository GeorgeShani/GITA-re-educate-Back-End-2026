import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsMongoId, ValidateNested } from 'class-validator';

import { RequestReturnItemDto } from './request-return-item.dto';

export class RequestReturnDto {
  @ApiProperty()
  @IsMongoId()
  orderId!: string;

  @ApiProperty({ type: [RequestReturnItemDto] })
  @ValidateNested({ each: true })
  @Type(() => RequestReturnItemDto)
  @ArrayMinSize(1)
  items!: RequestReturnItemDto[];
}
