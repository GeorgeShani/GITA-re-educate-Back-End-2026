import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { AuditService } from '#/core/audit/audit.service.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { RealtimeEmitter } from '#/realtime/realtime-emitter.service.js';
import { DataQualityReport } from '../data-quality-report.entity.js';
import { FilesService } from '../files.service.js';
import { type DataQualityMetrics, metricsSchema } from './metrics.js';
import type { PreviewCell } from './profile.js';
import { type RuleResult, ruleResultSchema } from './rules.js';

const recommendationsSchema = z.array(z.string());
const ruleResultsSchema = z.array(ruleResultSchema);
const previewSchema = z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])));

export interface ReportView {
  fileId: string;
  status: DataQualityReport['status'];
  metrics: DataQualityMetrics | null;
  narrative: { summary: string; recommendations: string[]; model: string } | null;
  errorMessage: string | null;
  profiledAt: Date | null;
  /** 0–100, an error counting double; null when no rule applied (or none is defined). */
  qualityScore: number | null;
  /** One result per rule the company had when the report was built; null when it had none. */
  ruleResults: RuleResult[] | null;
}

export interface PreviewView {
  columns: Array<{ name: string; inferredType: DataQualityMetrics['columns'][number]['inferredType'] }>;
  rows: PreviewCell[][];
  totalRows: number;
  truncated: boolean;
}

/**
 * Reads of a file's report and preview. Both start from `FilesService.requireVisible`, so
 * the ONE visibility rule decides them: a file the caller cannot see is a 404 here too,
 * and nothing about its contents leaks through a side door.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly files: FilesService,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeEmitter,
  ) {}

  async report(fileId: string): Promise<ReportView> {
    const row = await this.rowFor(fileId);

    const metrics = row.metrics === null ? null : metricsSchema.parse(row.metrics);
    const recommendations = recommendationsSchema.safeParse(row.recommendations ?? []);
    const ruleResults = ruleResultsSchema.safeParse(row.ruleResults ?? []);
    return {
      fileId,
      status: row.status,
      metrics,
      narrative: row.summaryText
        ? {
            summary: row.summaryText,
            recommendations: recommendations.success ? recommendations.data : [],
            model: row.model ?? 'unknown',
          }
        : null,
      errorMessage: row.errorMessage,
      profiledAt: row.profiledAt,
      qualityScore: row.qualityScore,
      ruleResults: ruleResults.success && row.ruleResults !== null ? ruleResults.data : null,
    };
  }

  /**
   * Builds the report again, from the same file, against the rules as they are NOW — how a company
   * gets an old file re-checked after changing its rules. Uploader or admin only. Refused (409) while a
   * build is already queued or running; the flip to `queued` and the task are one transaction, so two
   * requests cannot queue it twice.
   */
  async rebuild(fileId: string): Promise<ReportView> {
    const file = await this.files.requireManageable(fileId);

    await this.dataSource.transaction(async (manager) => {
      const flipped = await manager
        .createQueryBuilder()
        .update(DataQualityReport)
        .set({ status: 'queued', errorMessage: null, ruleResults: null, qualityScore: null })
        .where(`"fileId" = :fileId AND "companyId" = :companyId AND "status" IN ('ready', 'failed', 'unsupported')`, {
          fileId: file.id,
          companyId: file.companyId,
        })
        .execute();
      if (!flipped.affected) {
        throw new ConflictException('This report is already being built. Try again when it has finished.');
      }
      await this.queue.enqueue('build_data_quality_report', { fileId: file.id, companyId: file.companyId }, { manager });
      await this.audit.record(
        { action: 'report.rebuild_requested', target: { type: 'file', id: file.id }, metadata: { originalName: file.originalName } },
        manager,
      );
    });
    await this.realtime.fileStatus(file.id);
    return this.report(file.id);
  }

  /**
   * The first rows and the inferred column types. Served from what profiling stored, so a
   * request never parses an untrusted file. Until profiling has finished there is nothing
   * to show (409); if it cannot be produced for this file the reason is given (422).
   */
  async preview(fileId: string): Promise<PreviewView> {
    const row = await this.rowFor(fileId);

    if (row.status === 'queued' || row.status === 'profiling') {
      throw new ConflictException('The preview is still being prepared. Try again in a moment.');
    }
    if (row.status !== 'ready') {
      throw new UnprocessableEntityException(row.errorMessage ?? 'No preview is available for this file.');
    }

    const metrics = metricsSchema.parse(row.metrics);
    const rows = previewSchema.parse(row.previewRows ?? []);
    return {
      columns: metrics.columns.map((column) => ({ name: column.name, inferredType: column.inferredType })),
      rows,
      totalRows: metrics.rowCount,
      truncated: metrics.truncated || rows.length < metrics.rowCount,
    };
  }

  private async rowFor(fileId: string): Promise<DataQualityReport> {
    const file = await this.files.requireVisible(fileId);
    const row = await this.dataSource.getRepository(DataQualityReport).findOne({
      where: { fileId: file.id, companyId: file.companyId },
    });
    if (!row) throw new NotFoundException('No report exists for this file.');
    return row;
  }
}
