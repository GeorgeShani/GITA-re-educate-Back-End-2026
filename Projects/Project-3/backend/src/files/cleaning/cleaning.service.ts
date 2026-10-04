import { hkdfSync } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, type EntityManager } from 'typeorm';
import { z } from 'zod';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { StorageService } from '#/core/storage/storage.service.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { NotificationsService } from '#/notifications/notifications.service.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { PLAN_CATALOG, type Plan } from '#/subscriptions/plan-catalog.js';
import { DataQualityReport } from '../data-quality-report.entity.js';
import { DatasetSettings } from '../dataset-settings.entity.js';
import { FileAsset } from '../file-asset.entity.js';
import { FilesService } from '../files.service.js';
import { UnreadableFileError, type ParsedSheet, readSpreadsheet } from '../parsing/spreadsheet-reader.js';
import { PROFILE_LIMITS, metricsSchema } from '../quality/metrics.js';
import { type SpreadsheetMime, SPREADSHEET_MIME_TYPES, XLS_MIME } from '../spreadsheet-types.js';
import { CleaningJob } from './cleaning-job.entity.js';
import type {
  CleanFileDto,
  CleanPreviewDto,
  UpdateDatasetSettingsDto,
} from './cleaning.dto.js';
import { type StepOutcome, applyRecipe } from './engine.js';
import { type Recipe, recipeSchema } from './recipe.js';
import { writeSheet } from './sheet-writer.js';

export interface PreviewView {
  rowsBefore: number;
  rowsAfter: number;
  columns: string[];
  steps: StepOutcome[];
  samples: Array<{ row: number; cells: Array<{ before: string | null; after: string | null }> }>;
}

export interface SettingsView {
  datasetId: string;
  keyColumns: string[];
  recipe: Recipe | null;
  autoClean: boolean;
  autoCleanAvailable: boolean;
}

const NO_PLAN = 'No plan selected yet. Choose one with POST /subscriptions/me.';
const AUTO_CLEAN_REFUSAL =
  'Cleaning every new version automatically is on the Basic and Premium plans. Upgrade with PATCH /subscriptions/me, or clean a file by hand.';

function toSpreadsheetMime(value: string): SpreadsheetMime | null {
  return SPREADSHEET_MIME_TYPES.find((mime) => mime === value) ?? null;
}

/** The first thing wrong with a recipe, in words: `steps.2.column: Too small`. */
function describe(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return 'The recipe is not valid.';
  const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  return `${where}${issue.message}`;
}

export function parseRecipe(raw: unknown): Recipe {
  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) throw new BadRequestException(`Invalid recipe. ${describe(parsed.error)}`);
  return parsed.data;
}

/** Rewrites a file's data by a recipe, as the next version of its dataset. Every read of a file goes through the one visibility rule. */
@Injectable()
export class CleaningService {
  private readonly hashKey: Buffer;

  constructor(
    private readonly dataSource: DataSource,
    private readonly files: FilesService,
    private readonly storage: StorageService,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly context: RequestContextService,
    private readonly logger: PinoLogger,
    @Inject(APP_CONFIG) config: AppConfig,
  ) {
    this.logger.setContext(CleaningService.name);
    // A key of its own, derived from a server secret, so a fingerprint cannot be rebuilt by hashing guesses.
    this.hashKey = Buffer.from(hkdfSync('sha256', config.JWT_ACCESS_SECRET, 'gridline', 'cleaning-mask-v1', 32));
  }

  // ---- reading the file ---------------------------------------------------------

  /** The sheet to clean: the one asked for, else the one the file's report covers, else the first. */
  private async chosenSheet(file: Pick<FileAsset, 'id' | 'companyId'>, requested?: string): Promise<string | undefined> {
    if (requested !== undefined) return requested;
    const report = await this.dataSource.getRepository(DataQualityReport).findOne({ where: { fileId: file.id, companyId: file.companyId } });
    const parsed = report?.metrics ? metricsSchema.safeParse(report.metrics) : null;
    return parsed?.success ? (parsed.data.sheet?.name ?? undefined) : undefined;
  }

  private async load(file: FileAsset, sheet: string | undefined): Promise<{ parsed: ParsedSheet; mime: SpreadsheetMime }> {
    const mime = toSpreadsheetMime(file.mimeType);
    if (!mime) throw new UnprocessableEntityException('This file is not a spreadsheet Gridline can read.');
    if (mime === XLS_MIME) {
      throw new UnprocessableEntityException('Legacy .xls files cannot be cleaned. Save the file as .xlsx or .csv and upload it again.');
    }
    const bytes = await this.storage.get(file.storageKey);
    let parsed: ParsedSheet;
    try {
      parsed = await readSpreadsheet(bytes, mime, PROFILE_LIMITS, sheet === undefined ? {} : { sheet });
    } catch (error) {
      if (error instanceof UnreadableFileError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
    if (parsed.truncated || parsed.columnCount > PROFILE_LIMITS.maxColumns) {
      throw new UnprocessableEntityException(
        `This file is larger than Gridline can clean at once: up to ${PROFILE_LIMITS.maxRows.toLocaleString('en-US')} rows and ${PROFILE_LIMITS.maxColumns} columns.`,
      );
    }
    return { parsed, mime };
  }

  // ---- the dry run ---------------------------------------------------------------

  /** What a recipe WOULD do, counted over the whole file. Nothing is written. */
  async preview(fileId: string, dto: CleanPreviewDto): Promise<PreviewView> {
    const file = await this.files.requireManageable(fileId);
    const recipe = parseRecipe(dto.recipe);
    const { parsed } = await this.load(file, await this.chosenSheet(file, dto.sheet));
    const result = applyRecipe(parsed, recipe, { hashKey: this.hashKey });
    return {
      rowsBefore: result.rowsBefore,
      rowsAfter: result.rowsAfter,
      columns: result.header,
      steps: result.steps,
      samples: result.samples,
    };
  }

  // ---- asking for it ------------------------------------------------------------

  private planOf(companyId: string): Promise<Plan | null> {
    return this.dataSource
      .getRepository(Subscription)
      .findOne({ where: { companyId } })
      .then((subscription) => subscription?.plan ?? null);
  }

  /** Queues the cleaning. The page waits on the job; the work runs in the background and ends as the next version. */
  async start(fileId: string, dto: CleanFileDto): Promise<CleaningJob> {
    const file = await this.files.requireManageable(fileId);
    const recipe = parseRecipe(dto.recipe);
    if (file.mimeType === XLS_MIME) {
      throw new UnprocessableEntityException('Legacy .xls files cannot be cleaned. Save the file as .xlsx or .csv and upload it again.');
    }
    const plan = await this.planOf(file.companyId);
    if (!plan) throw new HttpException(NO_PLAN, HttpStatus.PAYMENT_REQUIRED);
    const wantsAuto = dto.autoClean === true;
    if (wantsAuto && dto.saveRecipe !== true) {
      throw new BadRequestException('`autoClean` needs `saveRecipe`: there has to be a saved recipe to apply.');
    }
    if (wantsAuto && !PLAN_CATALOG[plan].autoClean) throw new HttpException(AUTO_CLEAN_REFUSAL, HttpStatus.PAYMENT_REQUIRED);

    const actorUserId = this.context.userId;
    if (!actorUserId) throw new BadRequestException('A signed-in person is needed.');
    const sheet = await this.chosenSheet(file, dto.sheet);

    return this.dataSource.transaction(async (manager) => {
      const job = await manager.save(
        manager.create(CleaningJob, {
          companyId: file.companyId,
          fileId: file.id,
          requestedByUserId: actorUserId,
          trigger: 'manual',
          recipe,
          sheet: sheet ?? null,
          status: 'queued',
        }),
      );
      await this.queue.enqueue('apply_cleaning_recipe', { jobId: job.id, companyId: file.companyId }, { manager });
      if (dto.saveRecipe === true) {
        await this.upsertSettings(manager, file, actorUserId, { recipe, autoClean: wantsAuto });
      }
      return job;
    });
  }

  async job(fileId: string, jobId: string): Promise<CleaningJob> {
    const file = await this.files.requireVisible(fileId);
    const job = await this.dataSource.getRepository(CleaningJob).findOne({ where: { id: jobId, fileId: file.id, companyId: file.companyId } });
    if (!job) throw new NotFoundException('Cleaning job not found');
    return job;
  }

  // ---- doing it (the background task) -------------------------------------------

  /**
   * Runs one job to its end. A problem with the FILE or the recipe (too big, a version cap, a deleted file) is permanent: the job
   * is marked failed with the reason, the person is told, and the task succeeds (retrying would only fail the same way). Anything
   * else (storage, the database) is rethrown, so the queue retries it with backoff.
   */
  async run(jobId: string, companyId: string): Promise<void> {
    const jobs = this.dataSource.getRepository(CleaningJob);
    const job = await jobs.findOne({ where: { id: jobId, companyId } });
    if (!job || job.status === 'succeeded' || job.status === 'failed') return;
    await jobs.update({ id: job.id }, { status: 'running', errorMessage: null });

    try {
      const file = await this.dataSource.getRepository(FileAsset).findOne({ where: { id: job.fileId, companyId } });
      if (!file || file.deletedAt) throw new UnprocessableEntityException('The file was deleted before it could be cleaned.');
      const recipe = recipeSchema.safeParse(job.recipe);
      if (!recipe.success) throw new BadRequestException(`Invalid recipe. ${describe(recipe.error)}`);

      const { parsed, mime } = await this.load(file, job.sheet ?? undefined);
      const result = applyRecipe(parsed, recipe.data, { hashKey: this.hashKey, sampleSize: 0 });
      const written = await writeSheet(mime, result.header, result.rows, parsed.sheet?.name ?? 'Sheet1');
      const created = await this.files.createDerivedVersion({
        companyId,
        actorUserId: job.requestedByUserId,
        source: file,
        bytes: written.bytes,
        mimeType: written.mime,
        name: cleanedName(file.originalName, written.extension),
        derivation: {
          fromFileId: file.id,
          fromVersion: file.version,
          jobId: job.id,
          steps: result.steps.length,
          changed: result.steps.reduce((sum, step) => sum + step.changed, 0),
          rowsBefore: result.rowsBefore,
          rowsAfter: result.rowsAfter,
          trigger: job.trigger,
        },
      });
      await this.dataSource.transaction(async (manager) => {
        await manager.update(CleaningJob, { id: job.id }, {
          status: 'succeeded',
          resultFileId: created.id,
          steps: result.steps,
          rowsBefore: result.rowsBefore,
          rowsAfter: result.rowsAfter,
        });
        await this.notifications.notify(manager, companyId, [job.requestedByUserId], {
          type: 'file.cleaned',
          payload: {
            fileId: created.id,
            sourceFileId: file.id,
            fileName: created.originalName,
            version: created.version,
            steps: result.steps.length,
            changed: result.steps.reduce((sum, step) => sum + step.changed, 0),
            trigger: job.trigger,
          },
        });
      });
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        await this.fail(job, error.message);
        return;
      }
      await jobs.update({ id: job.id }, { status: 'queued' });
      throw error;
    }
  }

  /** The task has run out of retries. */
  async giveUp(jobId: string, companyId: string): Promise<void> {
    const job = await this.dataSource.getRepository(CleaningJob).findOne({ where: { id: jobId, companyId } });
    if (job && job.status !== 'succeeded' && job.status !== 'failed') {
      await this.fail(job, 'The cleaned version could not be made because of a problem on our side. Try again in a moment.');
    }
  }

  private async fail(job: CleaningJob, reason: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(CleaningJob, { id: job.id }, { status: 'failed', errorMessage: reason });
      const file = await manager.findOne(FileAsset, { where: { id: job.fileId, companyId: job.companyId } });
      await this.notifications.notify(manager, job.companyId, [job.requestedByUserId], {
        type: 'cleaning.failed',
        payload: { fileId: job.fileId, fileName: file?.originalName ?? 'a file', reason, trigger: job.trigger },
      });
    });
  }

  // ---- the dataset's saved settings ----------------------------------------------

  private async upsertSettings(
    manager: EntityManager,
    file: Pick<FileAsset, 'companyId' | 'datasetId'>,
    actorUserId: string,
    patch: { keyColumns?: string[]; recipe?: Recipe | null; autoClean?: boolean },
  ): Promise<DatasetSettings> {
    const existing = await manager.findOne(DatasetSettings, { where: { companyId: file.companyId, datasetId: file.datasetId } });
    const next = manager.create(DatasetSettings, {
      ...(existing ?? { companyId: file.companyId, datasetId: file.datasetId, keyColumns: [], recipe: null, autoClean: false }),
      ...(patch.keyColumns === undefined ? {} : { keyColumns: patch.keyColumns }),
      ...(patch.recipe === undefined ? {} : { recipe: patch.recipe }),
      ...(patch.autoClean === undefined ? {} : { autoClean: patch.autoClean }),
      updatedByUserId: actorUserId,
    });
    const saved = await manager.save(next);
    await this.audit.record(
      {
        action: 'dataset.settings_updated',
        target: { type: 'dataset', id: file.datasetId },
        metadata: {
          keyColumns: saved.keyColumns.length,
          hasRecipe: saved.recipe !== null,
          autoClean: saved.autoClean,
        },
      },
      manager,
    );
    return saved;
  }

  private view(datasetId: string, row: DatasetSettings | null, plan: Plan | null): SettingsView {
    const recipe = row?.recipe ? recipeSchema.safeParse(row.recipe) : null;
    return {
      datasetId,
      keyColumns: row?.keyColumns ?? [],
      recipe: recipe?.success ? recipe.data : null,
      autoClean: row?.autoClean ?? false,
      autoCleanAvailable: plan !== null && PLAN_CATALOG[plan].autoClean,
    };
  }

  /** What is saved for a dataset, for anyone who can see it. A dataset with nothing saved answers with the defaults. */
  async settings(datasetId: string): Promise<SettingsView> {
    const file = await this.files.latestOfDataset(datasetId);
    const row = await this.dataSource.getRepository(DatasetSettings).findOne({ where: { companyId: file.companyId, datasetId } });
    return this.view(datasetId, row, await this.planOf(file.companyId));
  }

  async saveSettings(datasetId: string, dto: UpdateDatasetSettingsDto): Promise<SettingsView> {
    const file = await this.files.requireManageableDataset(datasetId);
    const actorUserId = this.context.userId;
    if (!actorUserId) throw new BadRequestException('A signed-in person is needed.');
    if (dto.keyColumns === undefined && dto.recipe === undefined && dto.autoClean === undefined) {
      throw new BadRequestException('Provide `keyColumns`, `recipe` and/or `autoClean`.');
    }
    const recipe = dto.recipe === undefined || dto.recipe === null ? dto.recipe : parseRecipe(dto.recipe);
    const keyColumns = dto.keyColumns?.map((name) => name.trim());
    if (keyColumns && (keyColumns.length > 10 || keyColumns.some((name) => name === '' || name.length > 200))) {
      throw new BadRequestException('`keyColumns` takes up to 10 column names.');
    }
    const plan = await this.planOf(file.companyId);
    const existing = await this.dataSource.getRepository(DatasetSettings).findOne({ where: { companyId: file.companyId, datasetId } });
    const hasRecipe = recipe === undefined ? existing?.recipe !== null && existing?.recipe !== undefined : recipe !== null;
    const autoClean = recipe === null ? false : dto.autoClean;
    if (autoClean === true) {
      if (!hasRecipe) throw new BadRequestException('Save a `recipe` first: automatic cleaning applies it.');
      if (plan === null || !PLAN_CATALOG[plan].autoClean) throw new HttpException(AUTO_CLEAN_REFUSAL, HttpStatus.PAYMENT_REQUIRED);
    }
    const saved = await this.dataSource.transaction((manager) =>
      this.upsertSettings(manager, file, actorUserId, {
        ...(keyColumns === undefined ? {} : { keyColumns }),
        ...(recipe === undefined ? {} : { recipe }),
        ...(autoClean === undefined ? {} : { autoClean }),
      }),
    );
    return this.view(datasetId, saved, plan);
  }
}

/** `customers.csv` → `customers (cleaned).csv`: the new version says what it is, and a legacy name gets the extension it is written in. */
export function cleanedName(original: string, extension: 'csv' | 'xlsx'): string {
  const base = original.replace(/\.(csv|xlsx|xls)$/i, '').replace(/ \(cleaned\)$/, '');
  return `${base} (cleaned).${extension}`;
}
