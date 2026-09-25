import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { toOffsetPage } from '#/common/pagination/paginate.js';
import type { OffsetPage } from '#/common/pagination/paginated-result.js';
import { OffsetQueryDto } from '#/common/pagination/offset-query.dto.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { User } from '#/database/entities/user.entity.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { ApiKey } from './api-key.entity.js';
import { generateApiKey, scopesAllowedFor } from './api-key-token.js';
import type { CreateApiKeyDto } from './dto/create-api-key.dto.js';

/** Bounds what one person can leave lying around; revoked keys do not count. */
export const MAX_ACTIVE_KEYS_PER_USER = 25;

export interface CreatedApiKey {
  key: ApiKey;
  /** The only time the plaintext exists on our side. */
  plaintext: string;
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly audit: AuditService,
    private readonly context: RequestContextService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async create(dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    const companyId = this.context.requireCompanyId();
    const userId = this.context.requireUserId();
    const role = this.context.requireRole();

    const forbidden = dto.scopes.filter((scope) => !scopesAllowedFor(role).includes(scope));
    if (forbidden.length > 0) {
      throw new ForbiddenException(`Your role cannot grant these scopes: ${forbidden.join(', ')}.`);
    }

    const generated = generateApiKey();
    const key = await this.dataSource.transaction(async (manager) => {
      // The creator's row is the lock: two creations by one person queue here, so the cap holds.
      await manager
        .getRepository(User)
        .createQueryBuilder('u')
        .setLock('pessimistic_write')
        .where('u.id = :userId', { userId })
        .getOneOrFail();

      const active = await manager
        .getRepository(ApiKey)
        .createQueryBuilder('k')
        .where('k.companyId = :companyId AND k.createdByUserId = :userId AND k.revokedAt IS NULL', {
          companyId,
          userId,
        })
        .getCount();
      if (active >= MAX_ACTIVE_KEYS_PER_USER) {
        throw new ConflictException(
          `You already have ${MAX_ACTIVE_KEYS_PER_USER} active API keys. Revoke one before creating another.`,
        );
      }

      const saved = await manager.save(
        manager.create(ApiKey, {
          companyId,
          createdByUserId: userId,
          name: dto.name,
          prefix: generated.prefix,
          keyHash: generated.hash,
          scopes: dto.scopes,
          lastUsedAt: null,
          revokedAt: null,
        }),
      );
      await this.audit.record(
        {
          action: 'api_key.created',
          target: { type: 'api_key', id: saved.id },
          metadata: { name: saved.name, prefix: saved.prefix, scopes: saved.scopes },
        },
        manager,
      );
      return saved;
    });

    return { key, plaintext: generated.plaintext };
  }

  /** An admin sees every key in the company; an employee only their own. Newest first. */
  async list(query: OffsetQueryDto): Promise<OffsetPage<ApiKey>> {
    const qb = this.tenantScope.forCompany(
      this.dataSource.getRepository(ApiKey),
      this.context.requireCompanyId(),
      'k',
    );
    if (this.context.requireRole() !== 'admin') {
      qb.andWhere('k.createdByUserId = :userId', { userId: this.context.requireUserId() });
    }

    const [rows, total] = await qb
      .orderBy('k.createdAt', 'DESC')
      .addOrderBy('k.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return toOffsetPage(rows, total, query.page, query.limit);
  }

  /**
   * Revokes a key. An admin may revoke any key in the company, an employee only their own
   * (someone else's key is a 404, not a 403: it does not confirm the key exists). Repeating
   * it is harmless and audits nothing the second time.
   */
  async revoke(id: string): Promise<ApiKey> {
    const companyId = this.context.requireCompanyId();

    return this.dataSource.transaction(async (manager) => {
      const qb = this.tenantScope
        .forCompany(manager.getRepository(ApiKey), companyId, 'k')
        .andWhere('k.id = :id', { id });
      if (this.context.requireRole() !== 'admin') {
        qb.andWhere('k.createdByUserId = :userId', { userId: this.context.requireUserId() });
      }
      const key = await qb.getOne();
      if (!key) throw new NotFoundException('API key not found');

      // The conditional update settles a race between two revokes: only one of them writes.
      const result = await manager
        .createQueryBuilder()
        .update(ApiKey)
        .set({ revokedAt: this.clock.now() })
        .where('"id" = :id AND "revokedAt" IS NULL', { id })
        .execute();

      if (result.affected) {
        await this.audit.record(
          {
            action: 'api_key.revoked',
            target: { type: 'api_key', id },
            metadata: { name: key.name, prefix: key.prefix },
          },
          manager,
        );
      }
      return manager.findOneOrFail(ApiKey, { where: { id } });
    });
  }
}
