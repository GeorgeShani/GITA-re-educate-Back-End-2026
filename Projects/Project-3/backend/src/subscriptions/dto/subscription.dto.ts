import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PLANS, type Plan } from '../plan-catalog.js';

export class PeriodDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Inclusive, UTC midnight.' })
  @Expose()
  start!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Exclusive, UTC midnight.' })
  @Expose()
  end!: Date;

  @ApiProperty({ example: '2026-03-01', description: 'The period start date; the label usage is counted under.' })
  @Expose()
  key!: string;

  @ApiProperty({ example: 31 })
  @Expose()
  days!: number;
}

export class LimitsDto {
  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  maxEmployees!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  @Expose()
  maxSeats!: number | null;

  @ApiProperty()
  @Expose()
  filesPerPeriod!: number;
}

export class UsageDto {
  @ApiProperty({ description: 'Files uploaded in the current period.' })
  @Expose()
  files!: number;

  @ApiProperty({ description: 'Employees holding a seat — invited and active.' })
  @Expose()
  employees!: number;

  @ApiProperty({ description: 'Seats in use: the admin plus those employees.' })
  @Expose()
  seats!: number;
}

export class SubscriptionDto {
  @ApiProperty({ enum: PLANS })
  @Expose()
  plan!: Plan;

  @ApiProperty({ minimum: 1, maximum: 31, description: 'Day of the month the period rolls over on.' })
  @Expose()
  billingAnchorDay!: number;

  @ApiProperty({ type: () => PeriodDto })
  @Expose()
  @Type(() => PeriodDto)
  period!: PeriodDto;

  @ApiProperty({ type: () => LimitsDto })
  @Expose()
  @Type(() => LimitsDto)
  limits!: LimitsDto;

  @ApiProperty({ type: () => UsageDto })
  @Expose()
  @Type(() => UsageDto)
  usage!: UsageDto;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the current period ends and is invoiced.' })
  @Expose()
  nextDueDate!: Date;
}

export class PlanChangeResultDto {
  @ApiProperty({ type: () => SubscriptionDto })
  @Expose()
  @Type(() => SubscriptionDto)
  subscription!: SubscriptionDto;

  @ApiProperty({ enum: PLANS })
  @Expose()
  previousPlan!: Plan;

  @ApiProperty({ description: 'Total cents of the invoice that closed the outgoing plan (0 if nothing was owed yet).' })
  @Expose()
  prorationCents!: number;
}
