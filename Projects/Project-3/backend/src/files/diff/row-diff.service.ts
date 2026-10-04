import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { z } from 'zod';
import { StorageService } from '#/core/storage/storage.service.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { NotificationsService } from '#/notifications/notifications.service.js';
import { WebhookPublisher } from '#/outgoing-webhooks/webhook-publisher.service.js';
import { DataQualityReport } from '../data-quality-report.entity.js';
import { DatasetSettings } from '../dataset-settings.entity.js';
import { FileAsset } from '../file-asset.entity.js';
import { FilesService } from '../files.service.js';
import { UnreadableFileError, type ParsedSheet, readSpreadsheet } from '../parsing/spreadsheet-reader.js';
import { PROFILE_LIMITS, metricsSchema } from '../quality/metrics.js';
import { SPREADSHEET_MIME_TYPES, type SpreadsheetMime } from '../spreadsheet-types.js';
import { SheetCache } from '../explore/sheet-cache.js';
import { type DiffSummary, type RowChangeEntry, checkKeys, diffRows, suggestKeyColumns, suggestKeysFromData } from './row-diff.js';
import { VersionDiff } from './version-diff.entity.js';

const summarySchema = z.object({
  keyColumns: z.array(z.string()),
  rowsBefore: z.number(),
  rowsAfter: z.number(),
  added: z.number(),
  removed: z.number(),
  changed: z.number(),
  unchanged: z.number(),
  unmatchable: z.number(),
  columnsChanged: z.array(z.object({ column: z.string(), changed: z.number() })),
  columnsAdded: z.array(z.string()),
  columnsRemoved: z.array(z.string()),
});

const sampleSchema = z.array(
  z.object({
    change: z.enum(['added', 'removed', 'changed']),
    key: z.array(z.string()),
    cells: z.array(z.object({ column: z.string(), before: z.string().nullable(), after: z.string().nullable() })),
  }),
);

export interface RowDiffView {
  from: { fileId: string; version: number; originalName: string };
  to: { fileId: string; version: number; originalName: string };
  status: VersionDiff['status'] | 'none';
  keyColumns: string[];
  suggestedKeyColumns: string[];
  summary: DiffSummary | null;
  sample: RowChangeEntry[];
  errorMessage: string | null;
}

function toSpreadsheetMime(value: string): SpreadsheetMime | null {
  return SPREADSHEET_MIME_TYPES.find((mime) => mime === value) ?? null;
}

const TOO_BIG = `A file is too large to compare row by row: up to ${PROFILE_LIMITS.maxRows.toLocaleString('en-US')} rows and ${PROFILE_LIMITS.maxColumns} columns.`;

/** The row-by-row comparison of two versions of a dataset. Both versions pass the one visibility rule, as `compare` does. */
@Injectable()
export class RowDiffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly files: FilesService,
    private readonly storage: StorageService,
    private readonly queue: TaskQueue,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhookPublisher,
    private readonly cache: SheetCache,
    private readonly audit: AuditService,
  ) {}

  /** The two versions, oldest first, once the caller is known to see both and they are of one dataset. */
  private async pair(aId: string, bId: string): Promise<{ from: FileAsset; to: FileAsset }> {
    const [a, b] = [await this.files.requireVisible(aId), await this.files.requireVisible(bId)];
    if (a.datasetId !== b.datasetId) {
      throw new UnprocessableEntityException('These two files are not versions of the same file.');
    }
    if (a.id === b.id) throw new UnprocessableEntityException('Choose two different versions.');
    return a.version < b.version ? { from: a, to: b } : { from: b, to: a };
  }

  private async savedKeys(file: Pick<FileAsset, 'companyId' | 'datasetId'>): Promise<string[]> {
    const row = await this.dataSource.getRepository(DatasetSettings).findOne({ where: { companyId: file.companyId, datasetId: file.datasetId } });
    return row?.keyColumns ?? [];
  }

  private async columnNames(file: Pick<FileAsset, 'id' | 'companyId'>): Promise<string[]> {
    const row = await this.dataSource.getRepository(DataQualityReport).findOne({ where: { fileId: file.id, companyId: file.companyId } });
    const metrics = row?.status === 'ready' ? metricsSchema.safeParse(row.metrics) : null;
    return metrics?.success ? metrics.data.columns.map((column) => column.name) : [];
  }

  /** Before a comparison exists: the column that is filled in and never repeated in both versions; failing that, one whose name says it is a key. */
  private async suggest(from: FileAsset, to: FileAsset): Promise<string[]> {
    try {
      return suggestKeysFromData(await this.read(from), await this.read(to));
    } catch (error) {
      if (error instanceof HttpException) return suggestKeyColumns(await this.columnNames(from), await this.columnNames(to));
      throw error;
    }
  }

  /** What is known about the comparison of these two versions: nothing yet (`none`), under way, done, or why it could not be. */
  async view(aId: string, bId: string): Promise<RowDiffView> {
    const { from, to } = await this.pair(aId, bId);
    const row = await this.dataSource.getRepository(VersionDiff).findOne({ where: { companyId: from.companyId, fromFileId: from.id, toFileId: to.id } });
    const summary = row?.summary ? summarySchema.safeParse(row.summary) : null;
    const sample = row?.sample ? sampleSchema.safeParse(row.sample) : null;
    return {
      from: { fileId: from.id, version: from.version, originalName: from.originalName },
      to: { fileId: to.id, version: to.version, originalName: to.originalName },
      status: row?.status ?? 'none',
      keyColumns: row?.keyColumns ?? (await this.savedKeys(from)),
      suggestedKeyColumns: row ? [] : await this.suggest(from, to),
      summary: summary?.success ? summary.data : null,
      sample: sample?.success ? sample.data : [],
      errorMessage: row?.errorMessage ?? null,
    };
  }

  /** Asks for the comparison (again, with these keys if given). It is made in the background; read it with `view`. */
  async start(aId: string, bId: string, keys: string[] | undefined): Promise<RowDiffView> {
    const { from, to } = await this.pair(aId, bId);
    const keyColumns = (keys ?? (await this.savedKeys(from))).map((name) => name.trim()).filter((name) => name !== '');
    if (keyColumns.length === 0) {
      throw new BadRequestException('Say which columns identify a row (`keyColumns`), or save them for the file first.');
    }
    const existing = await this.dataSource.getRepository(VersionDiff).findOne({ where: { companyId: from.companyId, fromFileId: from.id, toFileId: to.id } });
    if (existing && (existing.status === 'queued' || existing.status === 'running')) {
      throw new ConflictException('This comparison is already being made. Try again in a moment.');
    }
    await this.dataSource.transaction(async (manager) => {
      await this.enqueue(manager, from, to, keyColumns, 'manual');
      await this.audit.record(
        {
          action: 'file.diff_requested',
          target: { type: 'file', id: to.id },
          metadata: { datasetId: to.datasetId, fromFileId: from.id, fromVersion: from.version, toVersion: to.version, keyColumns },
        },
        manager,
      );
    });
    return this.view(from.id, to.id);
  }

  private async enqueue(manager: EntityManager, from: FileAsset, to: FileAsset, keyColumns: string[], trigger: 'manual' | 'auto'): Promise<void> {
    const where = { companyId: from.companyId, fromFileId: from.id, toFileId: to.id };
    const row = await manager.findOne(VersionDiff, { where });
    const saved = await manager.save(
      manager.create(VersionDiff, {
        ...(row ?? where),
        keyColumns,
        trigger,
        status: 'queued',
        summary: null,
        sample: null,
        errorMessage: null,
      }),
    );
    await this.queue.enqueue('build_version_diff', { diffId: saved.id, companyId: from.companyId }, { manager });
  }

  /**
   * Called when a version's report is ready: if the dataset has saved key columns, a comparison with the version before it is
   * queued, in the same transaction as the report. Nothing is queued for a first version or a dataset without keys.
   */
  async queueAuto(manager: EntityManager, file: FileAsset): Promise<void> {
    if (file.version <= 1) return;
    const settings = await manager.findOne(DatasetSettings, { where: { companyId: file.companyId, datasetId: file.datasetId } });
    if (!settings || settings.keyColumns.length === 0) return;
    const previous = await manager
      .getRepository(FileAsset)
      .createQueryBuilder('f')
      .where('f."companyId" = :companyId AND f."datasetId" = :datasetId', { companyId: file.companyId, datasetId: file.datasetId })
      .andWhere('f.version < :version AND f."deletedAt" IS NULL', { version: file.version })
      .orderBy('f.version', 'DESC')
      .getOne();
    if (!previous) return;
    await this.enqueue(manager, previous, file, settings.keyColumns, 'auto');
  }

  // ---- reading the two files -----------------------------------------------------

  private async read(file: FileAsset): Promise<ParsedSheet> {
    const mime = toSpreadsheetMime(file.mimeType);
    if (!mime) throw new UnprocessableEntityException('This file is not a spreadsheet Gridline can read.');
    const report = await this.dataSource.getRepository(DataQualityReport).findOne({ where: { fileId: file.id, companyId: file.companyId } });
    const parsedMetrics = report?.metrics ? metricsSchema.safeParse(report.metrics) : null;
    const sheet = parsedMetrics?.success ? (parsedMetrics.data.sheet?.name ?? undefined) : undefined;
    const cached = this.cache.get(file.id, sheet);
    if (cached) return cached;
    let parsed: ParsedSheet;
    try {
      parsed = await readSpreadsheet(await this.storage.get(file.storageKey), mime, PROFILE_LIMITS, sheet === undefined ? {} : { sheet });
    } catch (error) {
      if (error instanceof UnreadableFileError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
    if (parsed.truncated || parsed.columnCount > PROFILE_LIMITS.maxColumns) throw new UnprocessableEntityException(TOO_BIG);
    this.cache.set(file.id, sheet, parsed);
    return parsed;
  }

  private async compute(from: FileAsset, to: FileAsset, keyColumns: string[], all: boolean) {
    const [before, after] = [await this.read(from), await this.read(to)];
    const problem = checkKeys(before, after, keyColumns);
    if (problem?.kind === 'no_keys') throw new BadRequestException('Say which columns identify a row.');
    if (problem?.kind === 'missing') {
      const version = problem.side === 'before' ? from.version : to.version;
      throw new UnprocessableEntityException(`Version ${version} has no column "${problem.column}", so rows cannot be matched by it.`);
    }
    return diffRows(before, after, keyColumns, { all });
  }

  // ---- the background task ---------------------------------------------------------

  /** Builds one comparison. A problem with the files or the keys is permanent (the row says why); anything else is retried. */
  async run(diffId: string, companyId: string): Promise<void> {
    const diffs = this.dataSource.getRepository(VersionDiff);
    const row = await diffs.findOne({ where: { id: diffId, companyId } });
    if (!row || row.status === 'ready' || row.status === 'failed') return;
    await diffs.update({ id: row.id }, { status: 'running', errorMessage: null });
    try {
      const files = this.dataSource.getRepository(FileAsset);
      const [from, to] = [await files.findOne({ where: { id: row.fromFileId, companyId } }), await files.findOne({ where: { id: row.toFileId, companyId } })];
      if (!from || !to || from.deletedAt || to.deletedAt) throw new UnprocessableEntityException('One of the versions was deleted.');
      const result = await this.compute(from, to, row.keyColumns, false);
      await this.dataSource.transaction(async (manager) => {
        await manager.update(VersionDiff, { id: row.id }, { status: 'ready', summary: result.summary, sample: result.sample });
        if (row.trigger === 'auto') await this.announce(manager, from, to, result.summary);
      });
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        await diffs.update({ id: row.id }, { status: 'failed', errorMessage: error.message });
        return;
      }
      await diffs.update({ id: row.id }, { status: 'queued' });
      throw error;
    }
  }

  async giveUp(diffId: string, companyId: string): Promise<void> {
    await this.dataSource.getRepository(VersionDiff).update(
      { id: diffId, companyId },
      { status: 'failed', errorMessage: 'The comparison could not be made because of a problem on our side. Ask for it again in a moment.' },
    );
  }

  /** "v4: 120 added, 3 removed, 57 changed", to the person who uploaded it and the admins, and to the company's webhooks. */
  private async announce(manager: EntityManager, from: FileAsset, to: FileAsset, summary: DiffSummary): Promise<void> {
    if (summary.added + summary.removed + summary.changed === 0) return;
    const admins = await this.notifications.activeAdminIds(manager, to.companyId);
    await this.notifications.notify(manager, to.companyId, [to.uploaderId, ...admins], {
      type: 'dataset.changed',
      payload: {
        datasetId: to.datasetId,
        fileId: to.id,
        fileName: to.originalName,
        version: to.version,
        previousVersion: from.version,
        added: summary.added,
        removed: summary.removed,
        changed: summary.changed,
      },
    });
    await this.webhooks.publish(manager, to.companyId, 'dataset.changed', {
      fileId: to.id,
      datasetId: to.datasetId,
      version: to.version,
      previousVersion: from.version,
      added: summary.added,
      removed: summary.removed,
      changed: summary.changed,
      unchanged: summary.unchanged,
    });
  }

  // ---- the download --------------------------------------------------------------------

  /** Every change as a CSV: a `change` column (added, removed, changed), the keys, then each column's value and, where it changed, what it was. */
  async csv(aId: string, bId: string): Promise<{ name: string; body: string }> {
    const { from, to } = await this.pair(aId, bId);
    const row = await this.dataSource.getRepository(VersionDiff).findOne({ where: { companyId: from.companyId, fromFileId: from.id, toFileId: to.id } });
    if (!row || row.status !== 'ready') {
      throw new ConflictException('Compare the rows first: there is nothing to download until a comparison is ready.');
    }
    const { summary, all } = await this.compute(from, to, row.keyColumns, true);
    const entries = all ?? [];
    const columns = [...new Set(entries.flatMap((entry) => entry.cells.map((cell) => cell.column)))];
    const changedColumns = [...new Set(entries.filter((entry) => entry.change === 'changed').flatMap((entry) => entry.cells.map((cell) => cell.column)))];
    const header = ['change', ...summary.keyColumns.map((key) => `key: ${key}`), ...columns, ...changedColumns.map((column) => `${column} (was)`)];
    const lines = [header.map(csvCell).join(',')];
    for (const entry of entries) {
      const byColumn = new Map(entry.cells.map((cell) => [cell.column, cell] as const));
      const now = columns.map((column) => {
        const cell = byColumn.get(column);
        if (!cell) return '';
        return entry.change === 'removed' ? cell.before : cell.after;
      });
      const was = changedColumns.map((column) => (entry.change === 'changed' ? (byColumn.get(column)?.before ?? '') : ''));
      lines.push([entry.change, ...entry.key, ...now, ...was].map(csvCell).join(','));
    }
    const base = to.originalName.replace(/\.(csv|xlsx|xls)$/i, '').replace(/ \(cleaned\)$/, '');
    return { name: `${base} v${from.version} to v${to.version} changes.csv`, body: `﻿${lines.join('\r\n')}\r\n` };
  }
}

function csvCell(value: string | null): string {
  const text = value ?? '';
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
