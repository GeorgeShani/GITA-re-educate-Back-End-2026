import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { DataQualityReport } from '../data-quality-report.entity.js';
import { FilesService } from '../files.service.js';
import { type DataQualityMetrics, metricsSchema } from './metrics.js';
import type { PreviewCell } from './profile.js';

const recommendationsSchema = z.array(z.string());
const previewSchema = z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])));

export interface ReportView {
  fileId: string;
  status: DataQualityReport['status'];
  metrics: DataQualityMetrics | null;
  narrative: { summary: string; recommendations: string[]; model: string } | null;
  errorMessage: string | null;
  profiledAt: Date | null;
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
  ) {}

  async report(fileId: string): Promise<ReportView> {
    const row = await this.rowFor(fileId);

    const metrics = row.metrics === null ? null : metricsSchema.parse(row.metrics);
    const recommendations = recommendationsSchema.safeParse(row.recommendations ?? []);
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
    };
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
