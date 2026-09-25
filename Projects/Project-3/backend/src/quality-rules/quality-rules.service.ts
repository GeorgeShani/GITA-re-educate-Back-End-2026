import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { ZodError } from 'zod';
import { toOffsetPage } from '#/common/pagination/paginate.js';
import type { OffsetPage } from '#/common/pagination/paginated-result.js';
import type { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { type RuleSpec, isColumnRule, ruleSpecSchema } from '#/files/quality/rules.js';
import { PLAN_CATALOG } from '#/subscriptions/plan-catalog.js';
import { SubscriptionsService } from '#/subscriptions/subscriptions.service.js';
import type { CreateQualityRuleDto, UpdateQualityRuleDto } from './dto/quality-rule.dto.js';
import { QualityRule } from './quality-rule.entity.js';

/**
 * How many `unique` rules a company may have. Each one makes the profiler remember a fingerprint of
 * every value in its column (bounded by the row budget), so this is a memory ceiling for the worker,
 * not a product tier: it applies to every plan.
 */
export const MAX_UNIQUE_RULES = 10;

const NO_PLAN = 'No plan selected yet. Choose one with POST /subscriptions/me to use this feature.';

const describe = (error: ZodError): string =>
  error.issues.map((issue) => `${issue.path.length > 0 ? `${issue.path.join('.')}: ` : ''}${issue.message}`).join('; ');

/** A rule's numbers, checked against the kind's schema (defaults filled in). 400 with what is wrong. */
export function parseSpec(kind: string, params: unknown): RuleSpec {
  const parsed = ruleSpecSchema.safeParse({ kind, params: params ?? {} });
  if (!parsed.success) throw new BadRequestException(`Invalid params for a \`${kind}\` rule: ${describe(parsed.error)}`);
  return parsed.data;
}

/** Every kind but `max_duplicate_rows` is about a column and must name it; that one must not. */
function checkColumnName(spec: RuleSpec, columnName: string | null): void {
  if (isColumnRule(spec.kind) && columnName === null) {
    throw new BadRequestException(`A \`${spec.kind}\` rule is about one column: provide \`columnName\`.`);
  }
  if (!isColumnRule(spec.kind) && columnName !== null) {
    throw new BadRequestException(`A \`${spec.kind}\` rule is about the whole file: leave out \`columnName\`.`);
  }
}

@Injectable()
export class QualityRulesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly subscriptions: SubscriptionsService,
    private readonly audit: AuditService,
    private readonly context: RequestContextService,
  ) {}

  /**
   * Creates a rule. The plan's limit is checked under the subscription row lock, so two admins
   * cannot both take the last slot (the same lock every writer of plan-related state takes).
   */
  async create(dto: CreateQualityRuleDto): Promise<QualityRule> {
    const companyId = this.context.requireCompanyId();
    const spec = parseSpec(dto.kind, dto.params);
    const columnName = dto.columnName ?? null;
    checkColumnName(spec, columnName);

    return this.dataSource.transaction(async (manager) => {
      const subscription = await this.subscriptions.lockForUpdate(manager, companyId);
      if (!subscription) throw new ConflictException(NO_PLAN);

      const existing = await this.tenantScope.forCompany(manager.getRepository(QualityRule), companyId, 'r').getMany();
      const limit = PLAN_CATALOG[subscription.plan].maxQualityRules;
      if (limit !== null && existing.length >= limit) {
        throw new ConflictException(
          `Your ${subscription.plan} plan allows ${limit} quality ${limit === 1 ? 'rule' : 'rules'} and you have ${existing.length}. ` +
            'Delete one or upgrade with PATCH /subscriptions/me.',
        );
      }
      if (spec.kind === 'unique' && existing.filter((rule) => rule.kind === 'unique').length >= MAX_UNIQUE_RULES) {
        throw new ConflictException(
          `A company can have at most ${MAX_UNIQUE_RULES} \`unique\` rules, because each one is checked by remembering the values of its column.`,
        );
      }

      const saved = await manager.save(
        manager.create(QualityRule, {
          companyId,
          name: dto.name,
          columnName,
          kind: spec.kind,
          params: spec.params,
          severity: dto.severity ?? 'error',
          enabled: dto.enabled ?? true,
          createdByUserId: this.context.requireUserId(),
        }),
      );
      await this.audit.record(
        {
          action: 'quality_rule.created',
          target: { type: 'quality_rule', id: saved.id },
          metadata: { name: saved.name, kind: saved.kind, columnName, severity: saved.severity, enabled: saved.enabled },
        },
        manager,
      );
      return saved;
    });
  }

  /** Oldest first, the order reports list results in. */
  async list(query: OffsetQueryDto): Promise<OffsetPage<QualityRule>> {
    const [rows, total] = await this.tenantScope
      .forCompany(this.dataSource.getRepository(QualityRule), this.context.requireCompanyId(), 'r')
      .orderBy('r.createdAt', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return toOffsetPage(rows, total, query.page, query.limit);
  }

  /**
   * Edits a rule. The kind is fixed (a different kind is a different rule); `params` REPLACES the
   * numbers and is checked against that kind. Reports already built keep the rule as it was.
   */
  async update(id: string, dto: UpdateQualityRuleDto): Promise<QualityRule> {
    const changed = (['name', 'columnName', 'params', 'severity', 'enabled'] as const).filter(
      (field) => dto[field] !== undefined,
    );
    if (changed.length === 0) throw new BadRequestException('Provide at least one field to change.');

    return this.dataSource.transaction(async (manager) => {
      const rule = await this.tenantScope
        .forCompany(manager.getRepository(QualityRule), this.context.requireCompanyId(), 'r')
        .andWhere('r.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!rule) throw new NotFoundException('Quality rule not found');

      const spec = parseSpec(rule.kind, dto.params ?? rule.params);
      const columnName = dto.columnName ?? rule.columnName;
      checkColumnName(spec, columnName);

      await manager.update(
        QualityRule,
        { id: rule.id },
        {
          name: dto.name ?? rule.name,
          columnName,
          params: spec.params,
          severity: dto.severity ?? rule.severity,
          enabled: dto.enabled ?? rule.enabled,
        },
      );
      await this.audit.record(
        {
          action: 'quality_rule.updated',
          target: { type: 'quality_rule', id: rule.id },
          metadata: { fields: changed },
        },
        manager,
      );
      return manager.findOneOrFail(QualityRule, { where: { id: rule.id } });
    });
  }

  /** Deletes a rule; the reports that already used it keep their snapshot of it. */
  async remove(id: string): Promise<QualityRule> {
    return this.dataSource.transaction(async (manager) => {
      const rule = await this.tenantScope
        .forCompany(manager.getRepository(QualityRule), this.context.requireCompanyId(), 'r')
        .andWhere('r.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!rule) throw new NotFoundException('Quality rule not found');

      await manager.delete(QualityRule, { id: rule.id });
      await this.audit.record(
        {
          action: 'quality_rule.deleted',
          target: { type: 'quality_rule', id: rule.id },
          metadata: { name: rule.name, kind: rule.kind },
        },
        manager,
      );
      return rule;
    });
  }
}
