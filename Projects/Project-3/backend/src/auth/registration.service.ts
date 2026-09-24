import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { AppConfig } from '../config/env.schema.js';
import { APP_CONFIG } from '../config/load-config.js';
import { CLOCK, type Clock } from '../core/clock/clock.js';
import { AuditService } from '../core/audit/audit.service.js';
import { TaskQueue } from '../core/tasks/task-queue.service.js';
import { AuthIdentity } from '../database/entities/auth-identity.entity.js';
import { Company } from '../database/entities/company.entity.js';
import { User } from '../database/entities/user.entity.js';
import { isUniqueViolation } from '../database/pg-errors.js';
import { AccountLookupService } from './account-lookup.service.js';
import { appLink } from './app-link.js';
import { ACTIVATION_TOKEN_TTL_MS } from './auth.constants.js';
import { AuthTokenService } from './auth-token.service.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import type { RegisterCompanyDto } from './dto/register-company.dto.js';

@Injectable()
export class RegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly authTokens: AuthTokenService,
    private readonly lookup: AccountLookupService,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /**
   * One transaction creates the company (`pending_activation`, `billingEmail`
   * = the registering address), the admin user (`invited` until they activate),
   * their password identity and the activation token, and queues the email.
   * If any of it fails, none of it exists — including the email.
   */
  async registerCompany(dto: RegisterCompanyDto): Promise<{ companyId: string; userId: string }> {
    // scrypt is deliberately slow; do it before opening the transaction rather
    // than holding a connection while it runs.
    const passwordHash = await this.hasher.hash(dto.password);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const company = await manager.save(
          manager.create(Company, {
            name: dto.companyName,
            billingEmail: dto.email,
            country: dto.country,
            industry: dto.industry,
            status: 'pending_activation',
            activatedAt: null,
          }),
        );

        const user = await manager.save(
          manager.create(User, {
            companyId: company.id,
            email: dto.email,
            // The brief's form has no name field; the local part is a readable
            // placeholder the admin replaces via PATCH /users/me.
            fullName: dto.email.split('@')[0] ?? dto.email,
            role: 'admin',
            status: 'invited',
            activatedAt: null,
            disabledAt: null,
          }),
        );

        await manager.save(
          manager.create(AuthIdentity, {
            userId: user.id,
            provider: 'password',
            // The provider's stable subject. For passwords that is the user's
            // own id — never the email, which is an attribute, not a key.
            providerUserId: user.id,
            email: dto.email,
            emailVerified: false,
            passwordHash,
            lastUsedAt: null,
          }),
        );

        const token = await this.authTokens.issue(
          manager,
          user.id,
          'activation',
          ACTIVATION_TOKEN_TTL_MS,
        );
        await this.queue.enqueue(
          'send_email',
          {
            template: 'activation',
            to: dto.email,
            vars: {
              companyName: company.name,
              activationUrl: appLink(this.config.APP_PUBLIC_URL, '/activate', token),
            },
          },
          { manager },
        );

        await this.audit.record(
          {
            action: 'company.registered',
            companyId: company.id,
            actorUserId: user.id,
            target: { type: 'company', id: company.id },
            metadata: { industry: company.industry, country: company.country },
          },
          manager,
        );

        return { companyId: company.id, userId: user.id };
      });
    } catch (error) {
      // `billingEmail` and the password-identity email are both unique; the
      // constraint, not a pre-check, is what is race-proof.
      if (isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  /** Spends the emailed token and turns the company and its admin `active`. */
  async activate(token: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const userId = await this.authTokens.consume(manager, 'activation', token);
      if (!userId) throw new BadRequestException('This activation link is invalid or has expired');

      const user = await manager.findOneOrFail(User, { where: { id: userId } });
      const now = this.clock.now();

      await manager.update(User, { id: user.id }, { status: 'active', activatedAt: now });
      await manager.update(
        Company,
        { id: user.companyId, status: 'pending_activation' },
        { status: 'active', activatedAt: now },
      );

      await this.audit.record(
        {
          action: 'company.activated',
          companyId: user.companyId,
          actorUserId: user.id,
          target: { type: 'company', id: user.companyId },
        },
        manager,
      );
    });
  }

  /**
   * Issues a fresh activation link. Says nothing about whether the address
   * exists — the caller always gets the same answer — and only acts for an
   * account that is genuinely still awaiting activation.
   */
  async resendActivation(email: string): Promise<void> {
    const identity = await this.lookup.findByLoginEmail(email);
    const user = identity?.user;
    const company = user?.company;
    if (!user || !company) return;
    if (user.status !== 'invited' || company.status !== 'pending_activation') return;

    await this.dataSource.transaction(async (manager) => {
      const token = await this.authTokens.issue(
        manager,
        user.id,
        'activation',
        ACTIVATION_TOKEN_TTL_MS,
      );
      await this.queue.enqueue(
        'send_email',
        {
          template: 'activation',
          to: email,
          vars: {
            companyName: company.name,
            activationUrl: appLink(this.config.APP_PUBLIC_URL, '/activate', token),
          },
        },
        { manager },
      );
      await this.audit.record(
        {
          action: 'company.activation_resent',
          companyId: company.id,
          actorUserId: user.id,
          target: { type: 'company', id: company.id },
        },
        manager,
      );
    });
  }
}
