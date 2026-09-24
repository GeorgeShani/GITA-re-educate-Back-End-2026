import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { AccountLookupService } from './account-lookup.service.js';
import { appLink } from './app-link.js';
import { PASSWORD_RESET_TOKEN_TTL_MS } from './auth.constants.js';
import { AuthTokenService } from './auth-token.service.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import { type Session, SessionService } from './session.service.js';

@Injectable()
export class PasswordService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly authTokens: AuthTokenService,
    private readonly lookup: AccountLookupService,
    private readonly sessions: SessionService,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Always succeeds from the caller's side; only an active password account gets an email. */
  async forgot(email: string): Promise<void> {
    const identity = await this.lookup.findByLoginEmail(email);
    const user = identity?.user;
    const company = user?.company;
    if (!identity?.passwordHash || !user || !company) return;
    if (user.status !== 'active' || company.status !== 'active') return;

    await this.dataSource.transaction(async (manager) => {
      const token = await this.authTokens.issue(
        manager,
        user.id,
        'password_reset',
        PASSWORD_RESET_TOKEN_TTL_MS,
      );
      await this.queue.enqueue(
        'send_email',
        {
          template: 'password_reset',
          to: email,
          vars: {
            fullName: user.fullName,
            resetUrl: appLink(this.config.APP_PUBLIC_URL, '/reset-password', token),
          },
        },
        { manager },
      );
      await this.audit.record(
        {
          action: 'auth.password_reset_requested',
          companyId: user.companyId,
          actorUserId: user.id,
          target: { type: 'user', id: user.id },
        },
        manager,
      );
    });
  }

  /** Sets the new password and signs every session out. */
  async reset(token: string, newPassword: string): Promise<void> {
    const passwordHash = await this.hasher.hash(newPassword);

    await this.dataSource.transaction(async (manager) => {
      const userId = await this.authTokens.consume(manager, 'password_reset', token);
      if (!userId) throw new BadRequestException('This reset link is invalid or has expired');

      const user = await manager.findOneOrFail(User, { where: { id: userId } });
      await this.replacePassword(manager, user, passwordHash);
      await this.audit.record(
        {
          action: 'auth.password_reset',
          companyId: user.companyId,
          actorUserId: user.id,
          target: { type: 'user', id: user.id },
        },
        manager,
      );
    });
  }

  /**
   * The signed-in user changes their own password. Every session — including
   * the one making this request — is signed out, and a fresh pair is returned,
   * so a stolen refresh token dies here while this device carries on.
   */
  async change(
    userId: string,
    dto: ChangePasswordDto,
    meta: { userAgent: string | undefined },
  ): Promise<Session> {
    const identity = await this.dataSource.manager.findOne(AuthIdentity, {
      where: { userId, provider: 'password' },
    });
    if (!identity?.passwordHash) {
      throw new BadRequestException('This account has no password to change');
    }
    if (!(await this.hasher.verify(dto.currentPassword, identity.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('The new password must differ from the current one');
    }

    const passwordHash = await this.hasher.hash(dto.newPassword);

    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOneOrFail(User, { where: { id: userId } });
      await this.replacePassword(manager, user, passwordHash);
      await this.audit.record(
        {
          action: 'auth.password_changed',
          companyId: user.companyId,
          actorUserId: user.id,
          target: { type: 'user', id: user.id },
        },
        manager,
      );
      return this.sessions.startSession(manager, user.id, randomUUID(), meta);
    });
  }

  private async replacePassword(
    manager: EntityManager,
    user: User,
    passwordHash: string,
  ): Promise<void> {
    const updated = await manager.update(
      AuthIdentity,
      { userId: user.id, provider: 'password' },
      { passwordHash },
    );
    if (!updated.affected) {
      throw new BadRequestException('This account has no password to change');
    }

    await this.sessions.revokeAllForUser(manager, user.id);
    await this.queue.enqueue(
      'send_email',
      { template: 'password_changed', to: user.email, vars: { fullName: user.fullName } },
      { manager },
    );
  }
}
