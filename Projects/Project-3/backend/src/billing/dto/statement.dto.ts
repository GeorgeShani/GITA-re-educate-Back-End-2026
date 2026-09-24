import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PLANS, type Plan } from '#/subscriptions/plan-catalog.js';

/**
 * One line of a bill. The four kinds share a shape with the kind-specific fields
 * optional, because OpenAPI's `oneOf` makes for a worse generated client than a
 * flat object whose `kind` says which fields to expect:
 *
 * - `seat`: `userId`, `activeDays`, `periodDays` (unit × active/period)
 * - `plan_base`: `billedDays`, `periodDays`
 * - `overage`: `files`
 */
export class LineItemDto {
  @ApiProperty({ enum: ['seat', 'plan_base', 'overage'] })
  @Expose()
  kind!: 'seat' | 'plan_base' | 'overage';

  @ApiProperty({ example: 'Employee seat' })
  @Expose()
  description!: string;

  @ApiProperty({ description: 'The full price this line is a fraction of, in cents.' })
  @Expose()
  unitCents!: number;

  @ApiProperty({ description: 'What this line costs, in integer cents.' })
  @Expose()
  amountCents!: number;

  @ApiPropertyOptional({ description: 'seat: the employee this seat is for.' })
  @Expose()
  userId?: string;

  @ApiPropertyOptional({ description: 'seat: days the employee was active in the period.' })
  @Expose()
  activeDays?: number;

  @ApiPropertyOptional({ description: 'plan_base: days the plan was billed.' })
  @Expose()
  billedDays?: number;

  @ApiPropertyOptional({ description: 'seat / plan_base: days in the whole period.' })
  @Expose()
  periodDays?: number;

  @ApiPropertyOptional({ description: 'overage: files beyond the plan’s included quota.' })
  @Expose()
  files?: number;
}

export class BillingPeriodDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Inclusive, UTC midnight.' })
  @Expose()
  start!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Exclusive, UTC midnight: when the next period starts.' })
  @Expose()
  end!: Date;

  @ApiProperty()
  @Expose()
  days!: number;
}

/** The running bill for the current period. */
export class StatementDto {
  @ApiProperty({ enum: PLANS })
  @Expose()
  plan!: Plan;

  @ApiProperty({ type: () => BillingPeriodDto })
  @Expose()
  @Type(() => BillingPeriodDto)
  period!: BillingPeriodDto;

  @ApiProperty({ type: () => [LineItemDto] })
  @Expose()
  @Type(() => LineItemDto)
  lineItems!: LineItemDto[];

  @ApiProperty({
    description:
      'What the invoice will be if nothing changes: employees active now are assumed to stay active to the end of the period, and files count as uploaded so far. Integer cents.',
  })
  @Expose()
  totalCents!: number;

  @ApiProperty({ description: 'Seats in use right now: the admin plus every active employee.' })
  @Expose()
  seats!: number;

  @ApiProperty({ description: 'Files uploaded so far this period.' })
  @Expose()
  filesThisPeriod!: number;

  @ApiProperty({ type: String, format: 'date-time', description: 'When the period ends and the invoice is finalized.' })
  @Expose()
  dueDate!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'When this statement was computed.' })
  @Expose()
  asOf!: Date;
}
