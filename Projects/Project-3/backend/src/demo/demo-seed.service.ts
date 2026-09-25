import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
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
import { readSpreadsheet } from '#/files/parsing/spreadsheet-reader.js';
import { PROFILE_LIMITS } from '#/files/quality/metrics.js';
import { narrativeInputFrom, profileSheet } from '#/files/quality/profile.js';
import { type RuleDefinition, evaluateRules, ruleSpecSchema, uniqueColumnKeys } from '#/files/quality/rules.js';
import { SubscriptionChange } from '#/subscriptions/subscription-change.entity.js';
import { Subscription } from '#/subscriptions/subscription.entity.js';
import { QualityRule } from '#/quality-rules/quality-rule.entity.js';
import { DEMO_ADMIN, DEMO_COMPANY, DEMO_EMPLOYEES, DEMO_FILES, DEMO_RULES } from './demo-data.js';

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
    const files = await Promise.all(
      DEMO_FILES.map(async (file) => {
        const bytes = Buffer.from(file.csv, 'utf8');
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
        return { file, bytes, profile, evaluation, narrative, id: randomUUID() };
      }),
    );
    return { rules, files };
  }

  private async write(
    manager: EntityManager,
    now: Date,
    { rules, files: prepared }: Awaited<ReturnType<DemoSeedService['prepareFiles']>>,
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
    for (const { file, bytes, profile, evaluation, narrative, id } of prepared) {
      const uploader = file.uploader === 'admin' ? admin : employees[file.uploader];
      if (!uploader) throw new Error(`Demo file ${file.name} names an employee that does not exist`);
      const uploadedAt = new Date(now.getTime() - file.daysAgo * DAY_MS);
      const storageKey = `companies/${companyId}/files/${id}`;
      await this.storage.put(storageKey, bytes, CSV);

      await manager.insert(FileAsset, {
        id,
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
      for (const index of file.restrictedTo ?? []) {
        const grantee = employees[index];
        if (grantee) await manager.insert(FileAccessGrant, { fileId: id, userId: grantee.id });
      }
      // The period the upload fell in decides which bill it counts towards.
      const inPrior = uploadedAt.getTime() < period.end.getTime();
      await manager.insert(UsageEvent, {
        companyId,
        fileId: id,
        periodKey: inPrior ? priorKey : currentKey,
        createdAt: uploadedAt,
      });
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
          action: 'file.uploaded',
          companyId,
          actorUserId: uploader.id,
          target: { type: 'file', id },
          metadata: { originalName: file.name, mimeType: CSV, sizeBytes: bytes.length, visibility: file.restrictedTo ? 'restricted' : 'company', grantCount: file.restrictedTo?.length ?? 0, overage: false },
        },
        manager,
      );
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
