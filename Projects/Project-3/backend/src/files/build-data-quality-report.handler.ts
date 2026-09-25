import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { AI_PROVIDER, type AiProvider } from '#/core/ai/ai-provider.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { StorageService } from '#/core/storage/storage.service.js';
import type { TaskHandler } from '#/core/tasks/task-handler.js';
import { NotificationsService } from '#/notifications/notifications.service.js';
import { RealtimeEmitter } from '#/realtime/realtime-emitter.service.js';
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

type ProfileOutcome =
  | { status: 'ready' }
  | { status: 'unsupported' }
  | { status: 'failed'; reason: string };

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
    private readonly realtime: RealtimeEmitter,
    private readonly notifications: NotificationsService,
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
    await this.realtime.fileStatus(fileId);

    let outcome: ProfileOutcome;
    try {
      outcome = await this.profile(reportId, file);
    } catch (error) {
      await reports.update(
        { id: reportId },
        { status: 'failed', errorMessage: 'Profiling hit a temporary problem and will be retried.' },
      );
      await this.realtime.fileStatus(fileId);
      throw error;
    }
    // Every outcome of `profile` (ready, unsupported, failed) is committed by now: announce it.
    await this.realtime.fileStatus(fileId);
    await this.notifyUploader(file, outcome);
  }

  /**
   * The uploader hears when the report is ready or has failed for good. A transient failure is
   * retried and says nothing (the retry will); `unsupported` (a legacy .xls) is not a failure of theirs.
   */
  private async notifyUploader(file: FileAsset, outcome: ProfileOutcome): Promise<void> {
    if (outcome.status === 'unsupported') return;
    try {
      await this.notifications.notify(
        this.dataSource.manager,
        file.companyId,
        [file.uploaderId],
        outcome.status === 'ready'
          ? { type: 'report.ready', payload: { fileId: file.id, fileName: file.originalName } }
          : {
              type: 'report.failed',
              payload: { fileId: file.id, fileName: file.originalName, reason: outcome.reason },
            },
      );
    } catch (error) {
      // The report is done and committed; an inbox that cannot be written must not fail (and so
      // retry) the whole task.
      this.logger.warn({ err: error, fileId: file.id }, 'Could not write the report notification');
    }
  }

  private async profile(reportId: string, file: FileAsset): Promise<ProfileOutcome> {
    const reports = this.dataSource.getRepository(DataQualityReport);
    const bytes = await this.storage.get(file.storageKey);

    if (!isSpreadsheetMime(file.mimeType)) {
      await reports.update({ id: reportId }, { status: 'failed', errorMessage: 'Unrecognised file type.' });
      return { status: 'failed', reason: 'Unrecognised file type.' };
    }

    let profile: ReturnType<typeof profileSheet>;
    try {
      profile = profileSheet(await readSpreadsheet(bytes, file.mimeType, PROFILE_LIMITS));
    } catch (error) {
      if (error instanceof UnsupportedFormatError) {
        await reports.update({ id: reportId }, { status: 'unsupported', errorMessage: error.message, profiledAt: this.clock.now() });
        return { status: 'unsupported' };
      }
      if (error instanceof UnreadableFileError) {
        await reports.update({ id: reportId }, { status: 'failed', errorMessage: error.message, profiledAt: this.clock.now() });
        return { status: 'failed', reason: error.message };
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
    return { status: 'ready' };
  }
}
