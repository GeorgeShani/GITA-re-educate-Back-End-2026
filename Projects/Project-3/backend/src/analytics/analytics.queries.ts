import type { EntityManager } from 'typeorm';
import { z } from 'zod';
import { Invoice } from '#/billing/invoice.entity.js';
import { DAY_MS, startOfUtcDay } from '#/billing/period.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import type { Plan } from '#/subscriptions/plan-catalog.js';
import { SubscriptionChange } from '#/subscriptions/subscription-change.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { type DayRange, eachDay } from './usage-range.js';

/**
 * The analytics aggregates, as plain functions over an `EntityManager`. REST serves them
 * today; the read-only GraphQL surface (Phase 13) calls the SAME functions, so the two
 * cannot disagree about a number. Every one is scoped through `TenantScope` first.
 *
 * Postgres returns aggregates (`COUNT`, `SUM`) as strings or bigints; each result is
 * parsed with Zod rather than trusted.
 */
const tenant = new TenantScope();

const number = z.coerce.number();

export interface FilesPerDayPoint {
  date: string;
  files: number;
}

/** Uploads per UTC day across `range`, with a zero for every day that had none. */
export async function filesPerDay(
  manager: EntityManager,
  companyId: string,
  range: DayRange,
): Promise<FilesPerDayPoint[]> {
  const rows = await tenant
    .forCompany(manager.getRepository(UsageEvent), companyId, 'ue')
    .select("to_char(ue.createdAt AT TIME ZONE 'UTC', 'YYYY-MM-DD')", 'day')
    .addSelect('COUNT(*)', 'files')
    .andWhere('ue.createdAt >= :from AND ue.createdAt < :to', { from: range.from, to: range.to })
    .groupBy('day')
    .getRawMany();

  const counts = new Map(
    z
      .array(z.object({ day: z.string(), files: number }))
      .parse(rows)
      .map((row) => [row.day, row.files]),
  );
  return eachDay(range).map((date) => ({ date, files: counts.get(date) ?? 0 }));
}

export interface EmployeeActivity {
  userId: string;
  fullName: string;
  files: number;
  bytes: number;
  lastUploadAt: Date;
}

/**
 * Who uploaded what in `range`. Reads through the usage events, so a since-removed
 * employee's history is still there (their user row is kept), and a deleted file still
 * counts: the upload happened.
 */
export async function uploadsByEmployee(
  manager: EntityManager,
  companyId: string,
  range: DayRange,
): Promise<EmployeeActivity[]> {
  const rows = await tenant
    .forCompany(manager.getRepository(UsageEvent), companyId, 'ue')
    .innerJoin(FileAsset, 'f', 'f.id = ue.fileId')
    .innerJoin(User, 'u', 'u.id = f.uploaderId')
    .select('u.id', 'userId')
    .addSelect('u.fullName', 'fullName')
    .addSelect('COUNT(*)', 'files')
    .addSelect('COALESCE(SUM(f.sizeBytes), 0)', 'bytes')
    .addSelect('MAX(ue.createdAt)', 'lastUploadAt')
    .andWhere('ue.createdAt >= :from AND ue.createdAt < :to', { from: range.from, to: range.to })
    .groupBy('u.id')
    .addGroupBy('u.fullName')
    .orderBy('files', 'DESC')
    .addOrderBy('u.fullName', 'ASC')
    .addOrderBy('u.id', 'ASC')
    .getRawMany();

  return z
    .array(
      z.object({
        userId: z.string(),
        fullName: z.string(),
        files: number,
        bytes: number,
        lastUploadAt: z.coerce.date(),
      }),
    )
    .parse(rows);
}

export interface StorageUsage {
  /** Live (not deleted) files right now, whatever `range` was asked for. */
  liveFiles: number;
  liveBytes: number;
  /** Bytes uploaded in `range`, including files deleted since. */
  uploadedBytesInRange: number;
}

export async function storageUsage(
  manager: EntityManager,
  companyId: string,
  range: DayRange,
): Promise<StorageUsage> {
  const live = await tenant
    .forCompany(manager.getRepository(FileAsset), companyId, 'f')
    .select('COUNT(*)', 'files')
    .addSelect('COALESCE(SUM(f.sizeBytes), 0)', 'bytes')
    .andWhere('f.deletedAt IS NULL')
    .getRawOne();

  const uploaded = await tenant
    .forCompany(manager.getRepository(UsageEvent), companyId, 'ue')
    .innerJoin(FileAsset, 'f', 'f.id = ue.fileId')
    .select('COALESCE(SUM(f.sizeBytes), 0)', 'bytes')
    .andWhere('ue.createdAt >= :from AND ue.createdAt < :to', { from: range.from, to: range.to })
    .getRawOne();

  const liveRow = z.object({ files: number, bytes: number }).parse(live);
  return {
    liveFiles: liveRow.files,
    liveBytes: liveRow.bytes,
    uploadedBytesInRange: z.object({ bytes: number }).parse(uploaded).bytes,
  };
}

export interface BurnDownPoint {
  date: string;
  /** Files uploaded so far this period, cumulative, at the end of `date`. */
  used: number;
  /** Where an even pace would be: `limit × days elapsed ÷ days in the period`, two decimals. */
  pace: number;
}

/**
 * Quota burn-down for one billing period: cumulative uploads against the plan's included
 * quota, one point per day from the period's first day through `through` (never the
 * future). Counts by the period an event was recorded in (`periodKey`), so it agrees with
 * the running bill exactly.
 */
export async function quotaBurnDown(
  manager: EntityManager,
  companyId: string,
  period: { start: Date; end: Date; key: string },
  limit: number,
  through: Date,
): Promise<BurnDownPoint[]> {
  const rows = await tenant
    .forCompany(manager.getRepository(UsageEvent), companyId, 'ue')
    .select("to_char(ue.createdAt AT TIME ZONE 'UTC', 'YYYY-MM-DD')", 'day')
    .addSelect('COUNT(*)', 'files')
    .andWhere('ue.periodKey = :key', { key: period.key })
    .groupBy('day')
    .getRawMany();
  const perDay = new Map(
    z
      .array(z.object({ day: z.string(), files: number }))
      .parse(rows)
      .map((row) => [row.day, row.files]),
  );

  // One point per day from the period's first day through `through` — never the future,
  // and never past the period's own last day.
  const lastDay = startOfUtcDay(new Date(Math.min(through.getTime(), period.end.getTime() - 1)));
  const throughDay = lastDay.getTime() < period.start.getTime() ? period.start : lastDay;
  const range: DayRange = {
    from: period.start,
    to: new Date(throughDay.getTime() + DAY_MS),
    days: Math.round((throughDay.getTime() - period.start.getTime()) / DAY_MS) + 1,
  };
  const periodDays = Math.round((period.end.getTime() - period.start.getTime()) / DAY_MS);

  let used = 0;
  return eachDay(range).map((date, index) => {
    used += perDay.get(date) ?? 0;
    return { date, used, pace: Math.round(((limit * (index + 1)) / periodDays) * 100) / 100 };
  });
}

export interface PlanChangeRecord {
  effectiveAt: Date;
  fromPlan: Plan | null;
  toPlan: Plan;
  prorationCents: number;
  /** The invoice that closed the outgoing period, when there was one. */
  invoiceId: string | null;
  invoiceTotalCents: number | null;
}

/**
 * Every plan the company has been on, newest change first: each change joined to the
 * invoice that closed the period it ended (its `periodEnd` is the switch day). The very
 * first choice has no outgoing plan, so no invoice.
 */
export async function planHistory(
  manager: EntityManager,
  companyId: string,
  limit = 50,
): Promise<PlanChangeRecord[]> {
  const rows = await tenant
    .forCompany(manager.getRepository(SubscriptionChange), companyId, 'sc')
    .leftJoin(
      Invoice,
      'inv',
      `inv.companyId = sc.companyId AND inv.periodEnd = (date_trunc('day', sc.effectiveAt AT TIME ZONE 'UTC') AT TIME ZONE 'UTC') AND sc.fromPlan IS NOT NULL`,
    )
    .select('sc.effectiveAt', 'effectiveAt')
    .addSelect('sc.fromPlan', 'fromPlan')
    .addSelect('sc.toPlan', 'toPlan')
    .addSelect('sc.prorationCents', 'prorationCents')
    .addSelect('inv.id', 'invoiceId')
    .addSelect('inv.totalCents', 'invoiceTotalCents')
    .orderBy('sc.effectiveAt', 'DESC')
    .addOrderBy('sc.id', 'DESC')
    .limit(limit)
    .getRawMany();

  const plan = z.enum(['free', 'basic', 'premium']);
  return z
    .array(
      z.object({
        effectiveAt: z.coerce.date(),
        fromPlan: plan.nullable(),
        toPlan: plan,
        prorationCents: number,
        invoiceId: z.string().nullable(),
        invoiceTotalCents: number.nullable(),
      }),
    )
    .parse(rows);
}
