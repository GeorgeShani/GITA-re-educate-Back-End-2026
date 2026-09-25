import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { PLANS, type Plan } from '#/subscriptions/plan-catalog.js';

export class DayRangeDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Inclusive, UTC midnight.' })
  @Expose()
  from!: Date;

  @ApiProperty({ type: String, format: 'date-time', description: 'Exclusive, UTC midnight.' })
  @Expose()
  to!: Date;

  @ApiProperty()
  @Expose()
  days!: number;
}

export class FilesPerDayDto {
  @ApiProperty({ example: '2026-03-05' }) @Expose() date!: string;
  @ApiProperty({ description: 'Files uploaded that UTC day; 0 for a quiet day, so every day has a point.' })
  @Expose()
  files!: number;
}

export class EmployeeActivityDto {
  @ApiProperty() @Expose() userId!: string;
  @ApiProperty() @Expose() fullName!: string;
  @ApiProperty() @Expose() files!: number;
  @ApiProperty({ description: 'Total size of what they uploaded in the range.' }) @Expose() bytes!: number;
  @ApiProperty({ type: String, format: 'date-time' }) @Expose() lastUploadAt!: Date;
}

export class StorageUsageDto {
  @ApiProperty({ description: 'Files that exist right now (deleted ones excluded), regardless of the range.' })
  @Expose()
  liveFiles!: number;

  @ApiProperty({ description: 'Bytes those files occupy.' }) @Expose() liveBytes!: number;

  @ApiProperty({ description: 'Bytes uploaded within the range, including files deleted since.' })
  @Expose()
  uploadedBytesInRange!: number;
}

export class BurnDownPointDto {
  @ApiProperty({ example: '2026-03-05' }) @Expose() date!: string;
  @ApiProperty({ description: 'Files uploaded this period so far, cumulative, at the end of that day.' })
  @Expose()
  used!: number;
  @ApiProperty({ description: 'Where an even pace would be: included files × days elapsed ÷ days in the period.' })
  @Expose()
  pace!: number;
}

export class QuotaBurnDownDto {
  @ApiProperty({ enum: PLANS }) @Expose() plan!: Plan;
  @ApiProperty({ description: 'Files included per billing period on this plan.' }) @Expose() limit!: number;
  @ApiProperty({ description: 'Files uploaded so far this period.' }) @Expose() used!: number;
  @ApiProperty({ type: String, format: 'date-time' }) @Expose() periodStart!: Date;
  @ApiProperty({ type: String, format: 'date-time', description: 'Exclusive: when the quota resets.' })
  @Expose()
  periodEnd!: Date;

  @ApiProperty({ type: () => [BurnDownPointDto], description: 'One point per day from the period start through today.' })
  @Expose()
  @Type(() => BurnDownPointDto)
  points!: BurnDownPointDto[];
}

export class PlanChangeDto {
  @ApiProperty({ type: String, format: 'date-time' }) @Expose() effectiveAt!: Date;
  @ApiProperty({ enum: PLANS, nullable: true, description: 'Null for the first plan chosen.' }) @Expose() fromPlan!: Plan | null;
  @ApiProperty({ enum: PLANS }) @Expose() toPlan!: Plan;
  @ApiProperty({ description: 'Integer cents billed for the outgoing plan’s part-period.' }) @Expose() prorationCents!: number;
  @ApiProperty({ type: String, nullable: true, description: 'The invoice that closed the outgoing period.' }) @Expose() invoiceId!: string | null;
  @ApiProperty({ type: Number, nullable: true }) @Expose() invoiceTotalCents!: number | null;
}

export class UsageAnalyticsDto {
  @ApiProperty({ type: () => DayRangeDto }) @Expose() @Type(() => DayRangeDto) range!: DayRangeDto;

  @ApiProperty({ type: () => [FilesPerDayDto] }) @Expose() @Type(() => FilesPerDayDto) filesPerDay!: FilesPerDayDto[];

  @ApiProperty({ type: () => [EmployeeActivityDto], description: 'Most active first. Includes people since removed.' })
  @Expose()
  @Type(() => EmployeeActivityDto)
  byEmployee!: EmployeeActivityDto[];

  @ApiProperty({ type: () => StorageUsageDto }) @Expose() @Type(() => StorageUsageDto) storage!: StorageUsageDto;

  @ApiProperty({ type: () => QuotaBurnDownDto, description: 'Always the CURRENT billing period, whatever the range.' })
  @Expose()
  @Type(() => QuotaBurnDownDto)
  quota!: QuotaBurnDownDto;

  @ApiProperty({ type: () => [PlanChangeDto], description: 'Newest change first, up to 50.' })
  @Expose()
  @Type(() => PlanChangeDto)
  planHistory!: PlanChangeDto[];
}
