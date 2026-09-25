import { randomUUID } from 'node:crypto';
import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { RefreshToken } from '#/database/entities/refresh-token.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { AccountLookupService } from './account-lookup.service.js';
import { REFRESH_TOKEN_TTL_MS } from './auth.constants.js';
import { AuthenticationService } from './authentication.service.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import { TokenFactory } from './crypto/token-factory.js';
import type { LoginDto } from './dto/login.dto.js';

export interface Session {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface ClientMeta {
  userAgent: string | undefined;
}

type RefreshOutcome =
  | { kind: 'ok'; session: Session }
  | { kind: 'rejected' };

const INVALID_REFRESH = 'Invalid or expired refresh token';

@Injectable()
export class SessionService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenFactory,
    private readonly lookup: AccountLookupService,
    private readonly authentication: AuthenticationService,
    private readonly context: RequestContextService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async login(dto: LoginDto, meta: ClientMeta): Promise<Session> {
    const identity = await this.lookup.findByLoginEmail(dto.email);

    // Always burn one scrypt's worth of time, so an unknown address costs the
    // same as a wrong password and response time can't enumerate accounts.
    const passwordOk = identity?.passwordHash
      ? await this.hasher.verify(dto.password, identity.passwordHash)
      : await this.hasher.verifyDummy(dto.password);

    const user = identity?.user;
    const company = user?.company;
    if (!identity || !user || !company || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Reached only with the correct password, so these say something specific
    // without helping an attacker — they already hold the credentials.
    if (company.status === 'pending_activation' || user.status === 'invited') {
      throw new ForbiddenException(
        'This account is not activated yet. Check your email for the activation link.',
      );
    }
    if (user.status === 'disabled') {
      throw new ForbiddenException('This account has been disabled');
    }
    if (company.status !== 'active') {
      throw new ForbiddenException('This company is not active');
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(AuthIdentity, { id: identity.id }, { lastUsedAt: this.clock.now() });
      return this.startSession(manager, user.id, randomUUID(), meta);
    });
  }

  /**
   * Rotates the refresh token. Presenting one that has already been rotated
   * (or revoked) means it was copied — the legitimate client and a thief both
   * hold it — so the whole family is revoked and both must log in again.
   *
   * The family revocation has to *commit*, so the transaction returns an
   * outcome and the 401 is thrown after it, not inside it.
   */
  async refresh(refreshToken: string, meta: ClientMeta): Promise<Session> {
    const hash = this.tokens.hash(refreshToken);

    const outcome = await this.dataSource.transaction(
      async (manager): Promise<RefreshOutcome> => {
        const now = this.clock.now();
        const presented = await manager.findOne(RefreshToken, { where: { tokenHash: hash } });
        if (!presented) return { kind: 'rejected' };

        if (presented.revokedAt) {
          await this.revokeFamily(manager, presented.familyId);
          return { kind: 'rejected' };
        }
        if (presented.expiresAt <= now) return { kind: 'rejected' };

        // Claim the token atomically. Two simultaneous refreshes with the same
        // token race here; exactly one UPDATE matches, the other is a replay.
        const claimed = await manager
          .createQueryBuilder()
          .update(RefreshToken)
          .set({ revokedAt: now })
          .where('"id" = :id AND "revokedAt" IS NULL', { id: presented.id })
          .execute();
        if (!claimed.affected) {
          await this.revokeFamily(manager, presented.familyId);
          return { kind: 'rejected' };
        }

        // Re-check the account: a disabled user or suspended company must not
        // be able to keep minting access tokens off an old refresh token.
        const user = await manager.findOne(User, {
          where: { id: presented.userId },
          relations: { company: true },
        });
        if (!user || user.status !== 'active' || user.company?.status !== 'active') {
          await this.revokeFamily(manager, presented.familyId);
          return { kind: 'rejected' };
        }

        const next = await this.mintSession(manager, user.id, presented.familyId, meta);
        await manager.update(
          RefreshToken,
          { id: presented.id },
          { replacedById: next.refreshTokenId },
        );
        return { kind: 'ok', session: next.session };
      },
    );

    if (outcome.kind === 'rejected') throw new UnauthorizedException(INVALID_REFRESH);
    return outcome.session;
  }

  /** Ends the session. Says nothing about whether the token was valid. */
  async logout(refreshToken: string): Promise<void> {
    const token = await this.dataSource.manager.findOne(RefreshToken, {
      where: { tokenHash: this.tokens.hash(refreshToken) },
    });
    if (token) await this.revokeFamily(this.dataSource.manager, token.familyId);
  }

  /** Signs every session out — password change and reset both use it. */
  async revokeAllForUser(manager: EntityManager, userId: string): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: this.clock.now() })
      .where('"userId" = :userId AND "revokedAt" IS NULL', { userId })
      .execute();
  }

  /** Issues an access + refresh pair, the refresh token starting (or continuing) `familyId`. */
  async startSession(
    manager: EntityManager,
    userId: string,
    familyId: string,
    meta: ClientMeta,
  ): Promise<Session> {
    return (await this.mintSession(manager, userId, familyId, meta)).session;
  }

  private async mintSession(
    manager: EntityManager,
    userId: string,
    familyId: string,
    meta: ClientMeta,
  ): Promise<{ session: Session; refreshTokenId: string }> {
    const issued = this.tokens.issue();
    const inserted = await manager.insert(RefreshToken, {
      userId,
      familyId,
      tokenHash: issued.hash,
      expiresAt: new Date(this.clock.now().getTime() + REFRESH_TOKEN_TTL_MS),
      revokedAt: null,
      replacedById: null,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      ip: this.context.ip ?? null,
    });

    const refreshTokenId: unknown = inserted.identifiers[0]?.id;
    if (typeof refreshTokenId !== 'string') throw new Error('refresh_token insert returned no id');

    const access = await this.authentication.signAccessToken(userId);
    return {
      refreshTokenId,
      session: {
        accessToken: access.token,
        refreshToken: issued.plaintext,
        tokenType: 'Bearer',
        expiresIn: access.expiresIn,
      },
    };
  }

  private async revokeFamily(manager: EntityManager, familyId: string): Promise<void> {
    await manager
      .createQueryBuilder()
      .update(RefreshToken)
      .set({ revokedAt: this.clock.now() })
      .where('"familyId" = :familyId AND "revokedAt" IS NULL', { familyId })
      .execute();
  }
}
