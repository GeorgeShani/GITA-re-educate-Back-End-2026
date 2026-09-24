import { Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { AuthToken, type AuthTokenType } from '#/database/entities/auth-token.entity.js';
import { TokenFactory } from './crypto/token-factory.js';

/**
 * Single-use, expiring, hashed tokens: activation, invite, password reset.
 * Always takes the caller's `EntityManager` — issuing a token is part of the
 * transaction that creates whatever the token unlocks.
 */
@Injectable()
export class AuthTokenService {
  constructor(
    private readonly tokens: TokenFactory,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Returns the plaintext to put in the email. Supersedes any earlier
   * unconsumed token of the same type for this user, so only the newest link
   * ever works — resending an invite kills the old one.
   */
  async issue(
    manager: EntityManager,
    userId: string,
    type: AuthTokenType,
    ttlMs: number,
  ): Promise<string> {
    const now = this.clock.now();

    await manager
      .createQueryBuilder()
      .update(AuthToken)
      .set({ consumedAt: now })
      .where('"userId" = :userId AND "type" = :type AND "consumedAt" IS NULL', { userId, type })
      .execute();

    const { plaintext, hash } = this.tokens.issue();
    await manager.insert(AuthToken, {
      userId,
      type,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + ttlMs),
      consumedAt: null,
    });

    return plaintext;
  }

  /**
   * Atomically spends the token and returns whose it was, or `null` when it is
   * unknown, of the wrong type, expired, or already spent. One UPDATE ... WHERE
   * ... RETURNING, so two concurrent requests with the same link cannot both
   * succeed — the loser matches zero rows.
   */
  async consume(
    manager: EntityManager,
    type: AuthTokenType,
    plaintext: string,
  ): Promise<string | null> {
    const now = this.clock.now();

    const result = await manager
      .createQueryBuilder()
      .update(AuthToken)
      .set({ consumedAt: now })
      .where(
        '"tokenHash" = :hash AND "type" = :type AND "consumedAt" IS NULL AND "expiresAt" > :now',
        { hash: this.tokens.hash(plaintext), type, now },
      )
      .returning(['userId'])
      .execute();

    const row: unknown = result.raw[0];
    if (typeof row === 'object' && row !== null && 'userId' in row && typeof row.userId === 'string') {
      return row.userId;
    }
    return null;
  }
}
