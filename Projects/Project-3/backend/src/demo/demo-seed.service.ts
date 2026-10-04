import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager, Not } from 'typeorm';
import { InvoicingService } from '#/billing/invoicing.service.js';
import { nextPeriod, openPeriodAt, periodKey } from '#/billing/period.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import { UsageEvent } from '#/billing/usage-event.entity.js';
import { AI_PROVIDER, type AiProvider } from '#/core/ai/ai-provider.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { StorageService } from '#/core/storage/storage.service.js';
import { BackgroundTask } from '#/core/tasks/background-task.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { isUniqueViolation } from '#/database/pg-errors.js';
import { DataQualityReport } from '#/files/data-quality-report.entity.js';
import { FileAccessGrant } from '#/files/file-access-grant.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';
import { applyRecipe } from '#/files/cleaning/engine.js';
import { recipeSchema } from '#/files/cleaning/recipe.js';
import { writeSheet } from '#/files/cleaning/sheet-writer.js';
import { DatasetSettings } from '#/files/dataset-settings.entity.js';
import { diffRows } from '#/files/diff/row-diff.js';
import { VersionDiff } from '#/files/diff/version-diff.entity.js';
import { readSpreadsheet } from '#/files/parsing/spreadsheet-reader.js';
import { PROFILE_LIMITS } from '#/files/quality/metrics.js';
import { narrativeInputFrom, profileSheet } from '#/files/quality/profile.js';
import { type RuleDefinition, evaluateRules, ruleSpecSchema, uniqueColumnKeys } from '#/files/quality/rules.js';
import { SubscriptionChange } from '#/subscriptions/subscription-change.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { QualityRule } from '#/quality-rules/quality-rule.entity.js';
import { DEMO_ADMIN, DEMO_COMPANY, DEMO_DATASET_SETTINGS, DEMO_EMPLOYEES, DEMO_FILES, DEMO_RULES } from './demo-data.js';

const DAY_MS = 86_400_000;
const CSV = 'text/csv';

export interface DemoSeedResult {
  /** `false` when a demo company already existed and nothing was written. */
  created: boolean;
  companyId: string;
}

/**
 * Builds the demo company: Basic plan, an admin and three employees, six files (one
 * restricted) with real data-quality reports, an audit trail, and a finalized invoice for
 * a period that has already closed. It goes through the app's OWN machinery where that is
 * cheap — the invoice is produced by `InvoicingService`, so the demo bill is what the real
 * calculator says — and writes rows directly only for the parts a request would need a
 * signed-in person for.
 *
 * Idempotent: a company already marked `isDemo` means "done", and the unique billing
 * address settles a race between two seeds. It never emails anyone: the invoice notice
 * `closePeriod` queues is removed, because the demo company's address is not a real one.
 */
@Injectable()
export class DemoSeedService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly invoicing: InvoicingService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    @Inject(AI_PROVIDER) private readonly ai: AiProvider,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async seed(): Promise<DemoSeedResult> {
    const existing = await this.dataSource.getRepository(Company).findOne({ where: { isDemo: true } });
    if (existing) return { created: false, companyId: existing.id };

    const now = this.clock.now();
    const prepared = await this.prepareFiles();

    try {
      const companyId = await this.dataSource.transaction((manager) => this.write(manager, now, prepared));
      return { created: true, companyId };
    } catch (error) {
      // Lost a race to another seed: the winner's company is the demo.
      if (isUniqueViolation(error)) {
        const winner = await this.dataSource.getRepository(Company).findOneOrFail({ where: { isDemo: true } });
        return { created: false, companyId: winner.id };
      }
      throw error;
    }
  }

  /** Profiles every file up front (parsing and the AI call must not hold a transaction open). */
  private async prepareFiles() {
    const rules: RuleDefinition[] = DEMO_RULES.map((rule) => ({
      ...ruleSpecSchema.parse({ kind: rule.kind, params: rule.params }),
      id: randomUUID(),
      name: rule.name,
      columnName: rule.columnName,
      severity: rule.severity,
    }));
    const files: Array<{ file: (typeof DEMO_FILES)[number]; bytes: Buffer; profile: ReturnType<typeof profileSheet>; evaluation: ReturnType<typeof evaluateRules>; narrative: Awaited<ReturnType<AiProvider['generateNarrative']>>; id: string; derivation: Record<string, unknown> | null }> = [];
    // In order: a cleaned version is made from the file before it.
    for (const file of DEMO_FILES) {
      {
        let bytes: Buffer = Buffer.from(file.csv, 'utf8');
        let derivation: Record<string, unknown> | null = null;
        if (file.clean && file.versionOf !== undefined) {
          const source = files[file.versionOf];
          if (!source) throw new Error(`Demo file ${file.name} is cleaned from a file that comes after it`);
          const recipe = recipeSchema.parse(file.clean);
          const parsed = await readSpreadsheet(source.bytes, CSV, PROFILE_LIMITS);
          const result = applyRecipe(parsed, recipe, { hashKey: randomBytes(32), sampleSize: 0 });
          bytes = (await writeSheet(CSV, result.header, result.rows, 'Sheet1')).bytes;
          derivation = {
            fromFileId: source.id,
            fromVersion: 1,
            steps: result.steps.length,
            changed: result.steps.reduce((sum, step) => sum + step.changed, 0),
            rowsBefore: result.rowsBefore,
            rowsAfter: result.rowsAfter,
            trigger: 'manual',
          };
        }
        const profile = profileSheet(await readSpreadsheet(bytes, CSV, PROFILE_LIMITS), {
          uniqueColumns: uniqueColumnKeys(rules),
        });
        const evaluation = evaluateRules(profile.metrics, rules, profile.uniqueness);
        const failed = evaluation.results.filter((result) => result.status === 'failed');
        const narrative = await this.ai.generateNarrative(
          narrativeInputFrom(
            profile.metrics,
            failed.map((result) => ({ name: result.name, severity: result.severity })),
          ),
        );
        files.push({ file, bytes, profile, evaluation, narrative, id: randomUUID(), derivation });
      }
    }

    // A dataset with a saved key was compared row by row when its next version arrived.
    const diffs = [];
    for (const settings of DEMO_DATASET_SETTINGS) {
      const base = files[settings.firstFile];
      const next = files.find((candidate) => candidate.file.versionOf === settings.firstFile && !candidate.file.clean);
      if (!base || !next) continue;
      const [before, after] = [await readSpreadsheet(base.bytes, CSV, PROFILE_LIMITS), await readSpreadsheet(next.bytes, CSV, PROFILE_LIMITS)];
      const result = diffRows(before, after, settings.keyColumns);
      diffs.push({ fromId: base.id, toId: next.id, keyColumns: [...settings.keyColumns], summary: result.summary, sample: result.sample });
    }
    return { rules, files, diffs };
  }

  private async write(
    manager: EntityManager,
    now: Date,
    { rules, files: prepared, diffs }: Awaited<ReturnType<DemoSeedService['prepareFiles']>>,
  ): Promise<string> {
    // The previous billing period ended a few days ago, so a real invoice exists to show.
    const firstDay = new Date(now.getTime() - 40 * DAY_MS);
    const { period, anchorDay } = openPeriodAt(firstDay);

    const company = await manager.save(
      manager.create(Company, {
        ...DEMO_COMPANY,
        status: 'active',
        activatedAt: firstDay,
        isDemo: true,
      }),
    );
    const companyId = company.id;

    const admin = await manager.save(
      manager.create(User, { companyId, ...DEMO_ADMIN, role: 'admin', status: 'active', activatedAt: firstDay, disabledAt: null }),
    );
    const employeeStart = new Date(period.start.getTime() + 3 * DAY_MS);
    const employees: User[] = [];
    for (const person of DEMO_EMPLOYEES) {
      const employee = await manager.save(
        manager.create(User, { companyId, ...person, role: 'employee', status: 'active', activatedAt: employeeStart, disabledAt: null }),
      );
      await manager.insert(SeatInterval, { companyId, userId: employee.id, activeFrom: employeeStart, activeTo: null });
      employees.push(employee);
    }

    const subscription = await manager.save(
      manager.create(Subscription, {
        companyId,
        plan: 'basic',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        billingAnchorDay: anchorDay,
      }),
    );
    await manager.insert(SubscriptionChange, {
      companyId,
      fromPlan: null,
      toPlan: 'basic',
      effectiveAt: period.start,
      prorationCents: 0,
    });

    await this.audit.record(
      { action: 'subscription.created', companyId, actorUserId: admin.id, target: { type: 'subscription', id: subscription.id }, metadata: { plan: 'basic' } },
      manager,
    );
    for (const employee of employees) {
      await this.audit.record(
        { action: 'employee.invited', companyId, actorUserId: admin.id, target: { type: 'user', id: employee.id }, metadata: { email: employee.email } },
        manager,
      );
      await this.audit.record(
        { action: 'employee.accepted_invite', companyId, actorUserId: employee.id, target: { type: 'user', id: employee.id } },
        manager,
      );
    }

    for (const rule of rules) {
      await manager.insert(QualityRule, {
        id: rule.id,
        companyId,
        name: rule.name,
        columnName: rule.columnName,
        kind: rule.kind,
        params: rule.params,
        severity: rule.severity,
        enabled: true,
        createdByUserId: admin.id,
      });
    }

    const priorKey = periodKey(period);
    const currentKey = periodKey(nextPeriod(anchorDay, period));
    const versions = new Map<string, number>();
    for (const { file, bytes, profile, evaluation, narrative, id, derivation } of prepared) {
      const uploader = file.uploader === 'admin' ? admin : employees[file.uploader];
      if (!uploader) throw new Error(`Demo file ${file.name} names an employee that does not exist`);
      const uploadedAt = new Date(now.getTime() - file.daysAgo * DAY_MS);
      const storageKey = `companies/${companyId}/files/${id}`;
      await this.storage.put(storageKey, bytes, CSV);

      const base = file.versionOf === undefined ? null : prepared[file.versionOf];
      const datasetId = base ? base.id : id;
      const version = (versions.get(datasetId) ?? 0) + 1;
      versions.set(datasetId, version);
      await manager.insert(FileAsset, {
        id,
        datasetId,
        version,
        isLatest: true,
        derivedFromFileId: derivation ? base?.id ?? null : null,
        ...(derivation ? { derivation } : {}),
        companyId,
        uploaderId: uploader.id,
        originalName: file.name,
        mimeType: CSV,
        sizeBytes: bytes.length,
        storageKey,
        visibility: file.restrictedTo ? 'restricted' : 'company',
        deletedAt: null,
        createdAt: uploadedAt,
      });
      if (version > 1) await manager.update(FileAsset, { datasetId, isLatest: true, id: Not(id) }, { isLatest: false });
      for (const index of file.restrictedTo ?? []) {
        const grantee = employees[index];
        if (grantee) await manager.insert(FileAccessGrant, { fileId: id, userId: grantee.id });
      }
      // The period the upload fell in decides which bill it counts towards.
      const inPrior = uploadedAt.getTime() < period.end.getTime();
      // A cleaned version is not an upload: it uses none of the file allowance.
      if (!derivation) {
        await manager.insert(UsageEvent, {
          companyId,
          fileId: id,
          periodKey: inPrior ? priorKey : currentKey,
          createdAt: uploadedAt,
        });
      }
      await manager.insert(DataQualityReport, {
        fileId: id,
        companyId,
        status: 'ready',
        metrics: profile.metrics,
        ruleResults: evaluation.results,
        qualityScore: evaluation.score,
        previewRows: profile.previewRows,
        summaryText: narrative?.summary ?? null,
        recommendations: narrative?.recommendations ?? null,
        model: narrative ? this.ai.model : null,
        errorMessage: null,
        profiledAt: uploadedAt,
      });
      await this.audit.record(
        {
          action: derivation ? 'file.cleaned' : 'file.uploaded',
          companyId,
          actorUserId: uploader.id,
          target: { type: 'file', id },
          metadata: { originalName: file.name, mimeType: CSV, sizeBytes: bytes.length, visibility: file.restrictedTo ? 'restricted' : 'company', grantCount: file.restrictedTo?.length ?? 0, overage: false },
        },
        manager,
      );
    }

    for (const settings of DEMO_DATASET_SETTINGS) {
      const first = prepared[settings.firstFile];
      if (first) await manager.insert(DatasetSettings, { companyId, datasetId: first.id, keyColumns: [...settings.keyColumns], autoClean: false, updatedByUserId: admin.id });
    }
    for (const diff of diffs) {
      await manager.insert(VersionDiff, { companyId, fromFileId: diff.fromId, toFileId: diff.toId, keyColumns: diff.keyColumns, trigger: 'auto', status: 'ready', summary: diff.summary, sample: diff.sample, errorMessage: null });
    }

    // Close the finished period with the real calculator and step onto the current one.
    await this.invoicing.rollForward(manager, subscription, now);
    // Nobody should be emailed on behalf of a demo company.
    await manager
      .createQueryBuilder()
      .delete()
      .from(BackgroundTask)
      .where(`type = 'send_email' AND payload->>'to' = :to`, { to: DEMO_COMPANY.billingEmail })
      .execute();

    return companyId;
  }
}
