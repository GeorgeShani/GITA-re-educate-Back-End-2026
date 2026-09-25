import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { AI_PROVIDER, type AiProvider } from '#/core/ai/ai-provider.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { StorageService } from '#/core/storage/storage.service.js';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { DataQualityReport } from './data-quality-report.entity.js';
import { FileAsset } from './file-asset.entity.js';
import {
  UnreadableFileError,
  UnsupportedFormatError,
  readSpreadsheet,
} from './parsing/spreadsheet-reader.js';
import { PROFILE_LIMITS } from './quality/metrics.js';
import { narrativeInputFrom, profileSheet } from './quality/profile.js';
import { SPREADSHEET_MIME_TYPES, type SpreadsheetMime } from './spreadsheet-types.js';

const payloadSchema = z.object({ fileId: z.uuid(), companyId: z.uuid() });
export type BuildDataQualityReportPayload = z.infer<typeof payloadSchema>;

function isSpreadsheetMime(value: string): value is SpreadsheetMime {
  return SPREADSHEET_MIME_TYPES.some((mime) => mime === value);
}

/**
 * Builds a file's data-quality report, in the background, queued by the upload's own
 * transaction. The steps, and what each failure means:
 *
 * 1. `profiling`. Read the object from storage. A storage or database error is
 *    TRANSIENT: the report goes to `failed` for now and the error is rethrown, so the
 *    task queue retries with backoff (and the retry flips it back to `profiling`, then
 *    `ready`). If the retries run out the report honestly stays `failed`.
 * 2. Parse and profile it. A file that cannot be read (corrupt, too large to open
 *    safely) is a PERMANENT outcome: `failed` with a message, and the task SUCCEEDS —
 *    retrying the same bytes would fail the same way.
 * 3. Ask the AI provider for a narrative. It never throws and never blocks: no
 *    narrative (`AI_PROVIDER=off`, a timeout, malformed output) still ships the metrics.
 *
 * The task runs outside any request, so it takes the company from its own payload and
 * queries with it explicitly. It is safe to run twice: a report already `ready` (or
 * `unsupported`) is left alone.
 */
@Injectable()
export class BuildDataQualityReportHandler implements TaskHandler<BuildDataQualityReportPayload> {
  readonly type = 'build_data_quality_report' as const;
  readonly schema = payloadSchema;

  constructor(
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.logger.setContext(BuildDataQualityReportHandler.name);
  }

  async handle({ fileId, companyId }: BuildDataQualityReportPayload): Promise<void> {
    const reports = this.dataSource.getRepository(DataQualityReport);
    const file = await this.dataSource.getRepository(FileAsset).findOne({ where: { id: fileId, companyId } });

    // Deleted (or never committed) before the worker got to it: nothing to profile.
    if (!file || file.deletedAt) {
      this.logger.info({ fileId }, 'Skipping the report: the file is gone');
      return;
    }

    const existing = await reports.findOne({ where: { fileId, companyId } });
    if (existing && (existing.status === 'ready' || existing.status === 'unsupported')) return;
    const reportId = existing?.id ?? (await reports.save(reports.create({ fileId, companyId, status: 'queued' }))).id;

    await reports.update({ id: reportId }, { status: 'profiling', errorMessage: null });

    try {
      await this.profile(reportId, file);
    } catch (error) {
      await reports.update(
        { id: reportId },
        { status: 'failed', errorMessage: 'Profiling hit a temporary problem and will be retried.' },
      );
      throw error;
    }
  }

  private async profile(reportId: string, file: FileAsset): Promise<void> {
    const reports = this.dataSource.getRepository(DataQualityReport);
    const bytes = await this.storage.get(file.storageKey);

    if (!isSpreadsheetMime(file.mimeType)) {
      await reports.update({ id: reportId }, { status: 'failed', errorMessage: 'Unrecognised file type.' });
      return;
    }

    let profile: ReturnType<typeof profileSheet>;
    try {
      profile = profileSheet(await readSpreadsheet(bytes, file.mimeType, PROFILE_LIMITS));
    } catch (error) {
      if (error instanceof UnsupportedFormatError) {
        await reports.update({ id: reportId }, { status: 'unsupported', errorMessage: error.message, profiledAt: this.clock.now() });
        return;
      }
      if (error instanceof UnreadableFileError) {
        await reports.update({ id: reportId }, { status: 'failed', errorMessage: error.message, profiledAt: this.clock.now() });
        return;
      }
      throw error;
    }

    const narrative = await this.ai.generateNarrative(narrativeInputFrom(profile.metrics));
    await reports.update(
      { id: reportId },
      {
        status: 'ready',
        metrics: profile.metrics,
        previewRows: profile.previewRows,
        summaryText: narrative?.summary ?? null,
        recommendations: narrative?.recommendations ?? null,
        model: narrative ? this.ai.model : null,
        errorMessage: null,
        profiledAt: this.clock.now(),
      },
    );
  }
}
