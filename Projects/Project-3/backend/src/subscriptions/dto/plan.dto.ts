import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { toDto } from '#/common/response/to-dto.js';
import { PLANS, PLAN_CATALOG, type Plan, maxSeats } from '../plan-catalog.js';

/** One entry of the public plan catalog — what a pricing page or plan picker renders. */
export class PlanDto {
  @ApiProperty({ enum: PLANS })
  @Expose()
  plan!: Plan;

  @ApiProperty({ type: Number, nullable: true, description: 'Employees allowed; null = unlimited.' })
  @Expose()
  maxEmployees!: number | null;

  @ApiProperty({ type: Number, nullable: true, description: 'Seats = the admin plus employees; null = unlimited.' })
  @Expose()
  maxSeats!: number | null;

  @ApiProperty({ description: 'Files per billing period before the over-quota rule applies.' })
  @Expose()
  filesPerPeriod!: number;

  @ApiProperty({ description: 'Cents per employee per full period (prorated by active days).' })
  @Expose()
  seatPriceCents!: number;

  @ApiProperty({ description: 'Flat cents per full period.' })
  @Expose()
  basePriceCents!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Cents per file over the quota; null = uploads over the quota are refused instead.',
  })
  @Expose()
  overagePerFileCents!: number | null;

  @ApiProperty({ description: 'Requests per minute the whole company may make, shared by its users and API keys.' })
  @Expose()
  rateLimitPerMinute!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Data-quality rules the company may keep, enabled or not; null = unlimited.',
  })
  @Expose()
  maxQualityRules!: number | null;

  static from(plan: Plan): PlanDto {
    return toDto(PlanDto, { plan, maxSeats: maxSeats(plan), ...PLAN_CATALOG[plan] });
  }
}
