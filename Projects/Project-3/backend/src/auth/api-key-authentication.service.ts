import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ApiKey } from '#/api-keys/api-key.entity.js';
import { API_KEY_FORMAT, effectiveScopes, hashApiKey } from '#/api-keys/api-key-token.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { User } from '#/database/entities/user.entity.js';
import type { Authentication } from './authentication.service.js';

/** `lastUsedAt` is refreshed at most this often per key, so authenticating is not a write per request. */
export const LAST_USED_GRANULARITY_MS = 5 * 60_000;

const INVALID = 'Invalid or revoked API key';

/**
 * The API-key half of "who is this?", beside `AuthenticationService`'s JWT half.
 *
 * A key is only a NAME for its creator: every request re-reads the creator's row and acts
 * as them, with their live role and status, narrowed to the key's scopes. Disable or
 * demote the creator and the very next request through their key changes with them.
 * Every "no" — malformed, unknown, revoked, creator gone or disabled — is the same 401, so
 * the response teaches nothing about which keys exist.
 */
@Injectable()
export class ApiKeyAuthenticationService {
  constructor(
    @InjectRepository(ApiKey) private readonly keys: Repository<ApiKey>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async authenticate(token: string): Promise<Authentication> {
    if (!API_KEY_FORMAT.test(token)) throw new UnauthorizedException(INVALID);

    const key = await this.keys.findOne({ where: { keyHash: hashApiKey(token) } });
    if (!key || key.revokedAt) throw new UnauthorizedException(INVALID);

    const creator = await this.users.findOne({
      where: { id: key.createdByUserId },
      relations: { company: true },
    });
    if (
      !creator ||
      creator.status !== 'active' ||
      !creator.company ||
      creator.companyId !== key.companyId
    ) {
      throw new UnauthorizedException(INVALID);
    }
    if (creator.company.status !== 'active' && creator.company.status !== 'suspended') {
      throw new ForbiddenException('This company is not active');
    }

    await this.touch(key.id);
    return {
      user: {
        userId: creator.id,
        companyId: creator.companyId,
        role: creator.role,
        authMethod: 'api_key',
        scopes: effectiveScopes(creator.role, key.scopes),
        apiKeyId: key.id,
      },
      companyStatus: creator.company.status,
    };
  }

  private async touch(id: string): Promise<void> {
    const now = this.clock.now();
    await this.keys
      .createQueryBuilder()
      .update(ApiKey)
      .set({ lastUsedAt: now })
      .where('"id" = :id AND ("lastUsedAt" IS NULL OR "lastUsedAt" < :threshold)', {
        id,
        threshold: new Date(now.getTime() - LAST_USED_GRANULARITY_MS),
      })
      .execute();
  }
}
