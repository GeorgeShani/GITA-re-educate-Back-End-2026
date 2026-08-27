import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AdjustGiftCardBalanceDto {
  @ApiProperty({
    description:
      'Minor units. Positive = add funds, negative = deduct (manual correction only — checkout redemption is a separate, not-yet-built flow).',
  })
  @IsInt()
  delta!: number;
}
