import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class StripeWebhookDto {
  @ApiProperty()
  @Expose()
  received!: boolean;

  @ApiProperty()
  @Expose()
  duplicate!: boolean;

  @ApiProperty()
  @Expose()
  applied!: boolean;
}
