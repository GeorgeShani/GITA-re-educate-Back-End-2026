import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { PLANS, type Plan } from '../plan-catalog.js';

/** Body of both `POST /subscriptions/me` (first choice) and `PATCH /subscriptions/me` (switch). */
export class ChoosePlanDto {
  @ApiProperty({ enum: PLANS })
  @IsIn(PLANS)
  plan!: Plan;
}
