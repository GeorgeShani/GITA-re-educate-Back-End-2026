import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { PLANS, type Plan } from '../plan-catalog.js';

export class PendingPlanDto {
  @ApiProperty({ enum: ['pending'] })
  @Expose()
  state!: 'pending';

  @ApiProperty({ format: 'uuid' })
  @Expose()
  intentId!: string;

  @ApiProperty({ enum: PLANS })
  @Expose()
  targetPlan!: Plan;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Hosted Stripe Checkout URL. Null for changes to an existing paid subscription.',
  })
  @Expose()
  checkoutUrl!: string | null;
}
