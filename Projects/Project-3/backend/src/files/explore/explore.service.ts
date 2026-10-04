import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ConflictException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DataSource, MoreThanOrEqual } from 'typeorm';
import { AI_PROVIDER, type AiProvider } from '#/core/ai/ai-provider.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { StorageService } from '#/core/storage/storage.service.js';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { DataQualityReport } from '../data-quality-report.entity.js';
import type { FileAsset } from '../file-asset.entity.js';
import { FilesService } from '../files.service.js';
import { UnreadableFileError, type ParsedSheet, readSpreadsheet } from '../parsing/spreadsheet-reader.js';
import { PROFILE_LIMITS, metricsSchema } from '../quality/metrics.js';
import { SPREADSHEET_MIME_TYPES, type SpreadsheetMime } from '../spreadsheet-types.js';
import { type QuerySpec, querySpecSchema } from '#/core/ai/query-spec.js';
import { AskEvent } from './ask-event.entity.js';
import { QueryError, type QueryResult, runQuery } from './executor.js';
import { SheetCache } from './sheet-cache.js';

export interface AskView {
  question: string;
  spec: QuerySpec;
  result: QueryResult;
  /** The model that planned the query. */
  model: string | null;
  questionsUsed: number;
  questionsLimit: number;
}

function toSpreadsheetMime(value: string): SpreadsheetMime | null {
  return SPREADSHEET_MIME_TYPES.find((mime) => mime === value) ?? null;
}

const AI_OFF = 'Questions need the AI assistant, which is switched off on this server. The query builder still works.';
const NO_ANSWER = 'The assistant could not answer that right now. Try again, or build the query yourself.';

/** Questions about the contents of a file: a query the person builds, or one the AI plans from a sentence. Same engine, same rules for who may read. */
@Injectable()
export class ExploreService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly files: FilesService,
    private readonly storage: StorageService,
    private readonly cache: SheetCache,
    private readonly context: RequestContextService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  private async reportOf(file: Pick<FileAsset, 'id' | 'companyId' | 'version'>): Promise<DataQualityReport> {
    const report = await this.dataSource.getRepository(DataQualityReport).findOne({ where: { fileId: file.id, companyId: file.companyId } });
    if (!report) throw new ConflictException('This file has no report yet.');
    return report;
  }

  /** The sheet to read: the one the file's report covers. A cached parse is reused; a fresh one is cached. */
  private async sheetOf(file: FileAsset, report: DataQualityReport): Promise<ParsedSheet> {
    const metrics = report.metrics ? metricsSchema.safeParse(report.metrics) : null;
    const name = metrics?.success ? (metrics.data.sheet?.name ?? undefined) : undefined;
    const cached = this.cache.get(file.id, name);
    if (cached) return cached;
    const mime = toSpreadsheetMime(file.mimeType);
    if (!mime) throw new UnprocessableEntityException('This file is not a spreadsheet Gridline can read.');
    let parsed: ParsedSheet;
    try {
      parsed = await readSpreadsheet(await this.storage.get(file.storageKey), mime, PROFILE_LIMITS, name === undefined ? {} : { sheet: name });
    } catch (error) {
      if (error instanceof UnreadableFileError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
    if (parsed.truncated || parsed.columnCount > PROFILE_LIMITS.maxColumns) {
      throw new UnprocessableEntityException(
        `This file is larger than Gridline can explore: up to ${PROFILE_LIMITS.maxRows.toLocaleString('en-US')} rows and ${PROFILE_LIMITS.maxColumns} columns.`,
      );
    }
    this.cache.set(file.id, name, parsed);
    return parsed;
  }

  private run(sheet: ParsedSheet, spec: QuerySpec): QueryResult {
    try {
      return runQuery(sheet, spec);
    } catch (error) {
      if (error instanceof QueryError) throw new UnprocessableEntityException(error.message);
      throw error;
    }
  }

  /** The query the person built, run over the whole file. Free of charge: it is the server computing, not the assistant. */
  async explore(fileId: string, rawSpec: unknown): Promise<QueryResult> {
    const file = await this.files.requireVisible(fileId);
    const parsedSpec = querySpecSchema.safeParse(rawSpec);
    if (!parsedSpec.success) {
      const issue = parsedSpec.error.issues[0];
      throw new BadRequestException(`Invalid query. ${issue ? `${issue.path.join('.')}${issue.path.length > 0 ? ': ' : ''}${issue.message}` : ''}`.trim());
    }
    const report = await this.reportOf(file);
    this.requireReady(report, file);
    return this.run(await this.sheetOf(file, report), parsedSpec.data);
  }

  private requireReady(report: DataQualityReport, file: Pick<FileAsset, 'version'>): void {
    if (report.status === 'queued' || report.status === 'profiling') {
      throw new ConflictException(`The report for version ${file.version} is still being prepared. Try again in a moment.`);
    }
    if (report.status !== 'ready') {
      throw new UnprocessableEntityException(report.errorMessage ?? 'This file could not be read, so it cannot be explored.');
    }
  }

  /** Questions asked so far in the company's current billing period, and what its plan allows. */
  private async quota(companyId: string): Promise<{ used: number; limit: number }> {
    const subscription = await this.dataSource.getRepository(Subscription).findOne({ where: { companyId } });
    if (!subscription) throw new HttpException('No plan selected yet. Choose one with POST /subscriptions/me.', HttpStatus.PAYMENT_REQUIRED);
    const now = this.clock.now();
    // A period that has ended but is not yet rolled forward has no questions in the new one.
    const since = now >= subscription.currentPeriodEnd ? subscription.currentPeriodEnd : subscription.currentPeriodStart;
    const used = await this.dataSource.getRepository(AskEvent).count({ where: { companyId, createdAt: MoreThanOrEqual(since) } });
    return { used, limit: PLAN_CATALOG[subscription.plan].questionsPerPeriod };
  }

  /**
   * A question in words. The assistant is shown the question and each column's name and type, never a value, and answers with a
   * structured query; the server validates that query and runs it itself, so no data is ever sent to the model and the model can
   * do no more than the query builder can. Counted against the plan only once the assistant has planned something.
   */
  async ask(fileId: string, question: string): Promise<AskView> {
    const file = await this.files.requireVisible(fileId);
    if (this.ai.name === 'off') throw new ServiceUnavailableException(AI_OFF);
    const report = await this.reportOf(file);
    this.requireReady(report, file);
    const metrics = report.metrics ? metricsSchema.safeParse(report.metrics) : null;
    if (!metrics?.success) throw new UnprocessableEntityException('This file has no columns to ask about.');

    const quota = await this.quota(file.companyId);
    if (quota.used >= quota.limit) {
      throw new HttpException(
        `Your plan answers ${quota.limit.toLocaleString('en-US')} questions a billing period and this period's are used. Build the query yourself (it is free), or upgrade with PATCH /subscriptions/me.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const plan = await this.ai.planQuery({ question, columns: metrics.data.columns.map((column) => ({ name: column.name, type: column.inferredType })) });
    if (!plan) throw new ServiceUnavailableException(NO_ANSWER);
    if (!plan.ok) throw new UnprocessableEntityException(`The assistant could not answer that from this file: ${plan.reason}`);

    await this.dataSource.getRepository(AskEvent).insert({ companyId: file.companyId, fileId: file.id, userId: this.context.userId ?? null });
    const result = this.run(await this.sheetOf(file, report), plan.spec);
    return { question, spec: plan.spec, result, model: this.ai.model, questionsUsed: quota.used + 1, questionsLimit: quota.limit };
  }

  /** What is left of this period's questions, for the page to show before anyone asks. */
  async allowance(fileId: string): Promise<{ aiAvailable: boolean; questionsUsed: number; questionsLimit: number }> {
    const file = await this.files.requireVisible(fileId);
    const quota = await this.quota(file.companyId);
    return { aiAvailable: this.ai.name !== 'off', questionsUsed: quota.used, questionsLimit: quota.limit };
  }
}
