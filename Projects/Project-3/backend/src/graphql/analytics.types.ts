import { Field, Float, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { PLANS, type Plan } from '#/subscriptions/plan-catalog.js';

/** A list can be as long as the range asked for (up to a year), so it costs a multiple of what is in it. */
const LIST_COST = 10;
const listComplexity = ({ childComplexity }: { childComplexity: number }) => 1 + childComplexity * LIST_COST;

const PLAN_VALUES: Record<Plan, Plan> = { free: 'free', basic: 'basic', premium: 'premium' };
registerEnumType(PLAN_VALUES, { name: 'Plan', description: `One of ${PLANS.join(', ')}.` });

/*
 * These mirror the REST response of `GET /analytics/usage` field for field — the resolver returns
 * the same object `AnalyticsService` builds for REST, so the two can only disagree if a type here
 * drifts from it (the integration spec compares the numbers).
 */

@ObjectType('DayRange')
export class DayRangeType {
  @Field(() => Date, { description: 'Inclusive, UTC midnight.' }) from!: Date;
  @Field(() => Date, { description: 'Exclusive, UTC midnight.' }) to!: Date;
  @Field(() => Int) days!: number;
}

@ObjectType('FilesPerDayPoint')
export class FilesPerDayPointType {
  @Field(() => String, { description: 'UTC day, `YYYY-MM-DD`.' }) date!: string;
  @Field(() => Int, { description: 'Files uploaded that day; 0 for a quiet day.' }) files!: number;
}

@ObjectType('EmployeeActivity')
export class EmployeeActivityType {
  @Field(() => String) userId!: string;
  @Field(() => String) fullName!: string;
  @Field(() => Int) files!: number;
  @Field(() => Float, { description: 'Total size of what they uploaded in the range.' }) bytes!: number;
  @Field(() => Date) lastUploadAt!: Date;
}

@ObjectType('StorageUsage')
export class StorageUsageType {
  @Field(() => Int, { description: 'Files that exist right now, whatever the range.' }) liveFiles!: number;
  @Field(() => Float) liveBytes!: number;
  @Field(() => Float, { description: 'Bytes uploaded in the range, including files deleted since.' })
  uploadedBytesInRange!: number;
}

@ObjectType('BurnDownPoint')
export class BurnDownPointType {
  @Field(() => String) date!: string;
  @Field(() => Int, { description: 'Files uploaded this period so far, cumulative, at the end of that day.' }) used!: number;
  @Field(() => Float, { description: 'Where an even pace would be.' }) pace!: number;
}

@ObjectType('QuotaBurnDown')
export class QuotaBurnDownType {
  @Field(() => PLAN_VALUES) plan!: Plan;
  @Field(() => Int) limit!: number;
  @Field(() => Int) used!: number;
  @Field(() => Date) periodStart!: Date;
  @Field(() => Date, { description: 'Exclusive: when the quota resets.' }) periodEnd!: Date;
  @Field(() => [BurnDownPointType], { complexity: listComplexity }) points!: BurnDownPointType[];
}

@ObjectType('PlanChange')
export class PlanChangeType {
  @Field(() => Date) effectiveAt!: Date;
  @Field(() => PLAN_VALUES, { nullable: true }) fromPlan!: Plan | null;
  @Field(() => PLAN_VALUES) toPlan!: Plan;
  @Field(() => Int, { description: 'Integer cents billed for the outgoing plan’s part-period.' }) prorationCents!: number;
  @Field(() => String, { nullable: true }) invoiceId!: string | null;
  @Field(() => Int, { nullable: true }) invoiceTotalCents!: number | null;
}

@ObjectType('UsageAnalytics')
export class UsageAnalyticsType {
  @Field(() => DayRangeType) range!: DayRangeType;
  @Field(() => [FilesPerDayPointType], { complexity: listComplexity }) filesPerDay!: FilesPerDayPointType[];
  @Field(() => [EmployeeActivityType], { complexity: listComplexity }) byEmployee!: EmployeeActivityType[];
  @Field(() => StorageUsageType) storage!: StorageUsageType;
  @Field(() => QuotaBurnDownType, { description: 'Always the CURRENT billing period, whatever the range.' })
  quota!: QuotaBurnDownType;
  @Field(() => [PlanChangeType], { complexity: listComplexity }) planHistory!: PlanChangeType[];
}
