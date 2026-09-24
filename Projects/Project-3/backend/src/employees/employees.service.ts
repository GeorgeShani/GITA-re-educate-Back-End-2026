import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AccountLookupService } from '#/auth/account-lookup.service.js';
import { appLink } from '#/auth/app-link.js';
import { INVITE_TOKEN_TTL_MS } from '#/auth/auth.constants.js';
import { AuthTokenService } from '#/auth/auth-token.service.js';
import { SessionService } from '#/auth/session.service.js';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import type { AppConfig } from '#/config/env.schema.js';
import { APP_CONFIG } from '#/config/load-config.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { TaskQueue } from '#/core/tasks/task-queue.service.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { AuthToken } from '#/database/entities/auth-token.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { isUniqueViolation } from '#/database/pg-errors.js';
import { TenantScope } from '#/database/tenant-scope.js';
import { type OffsetPage } from '#/common/pagination/paginated-result.js';
import { toOffsetPage } from '#/common/pagination/paginate.js';
import { SubscriptionsService } from '#/subscriptions/subscriptions.service.js';
import type { EmployeesQueryDto } from './dto/employees-query.dto.js';
import type { InviteEmployeeDto } from './dto/invite-employee.dto.js';
import { seatCapProblem } from './seat-cap.js';

const NO_PLAN = 'No plan selected yet. Choose one with POST /subscriptions/me to use this feature.';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly subscriptions: SubscriptionsService,
    private readonly authTokens: AuthTokenService,
    private readonly sessions: SessionService,
    private readonly lookup: AccountLookupService,
    private readonly queue: TaskQueue,
    private readonly audit: AuditService,
    private readonly context: RequestContextService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Invites a new employee. One transaction, holding the subscription row lock,
   * counts the seats held against the plan's cap and creates the `invited` user,
   * its invite token and the email — so two admins inviting at once can never
   * both take the last seat.
   */
  async invite(dto: InviteEmployeeDto): Promise<User> {
    const companyId = this.context.requireCompanyId();

    // A password sign-in email identifies exactly one account (see AuthIdentity).
    // Refuse now rather than send an invitation that dead-ends on accept.
    if (await this.lookup.findByLoginEmail(dto.email)) {
      throw new ConflictException(
        'That email address already belongs to a Gridline account, so it cannot be invited.',
      );
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const subscription = await this.subscriptions.lockForUpdate(manager, companyId);
        if (!subscription) throw new HttpException(NO_PLAN, HttpStatus.PAYMENT_REQUIRED);

        const problem = seatCapProblem(
          subscription.plan,
          await this.subscriptions.employeeSeatsHeld(manager, companyId),
        );
        if (problem) throw new ConflictException(problem);

        const user = await manager.save(
          manager.create(User, {
            companyId,
            email: dto.email,
            fullName: dto.fullName,
            role: 'employee',
            status: 'invited',
            activatedAt: null,
            disabledAt: null,
          }),
        );

        await this.sendInvite(manager, user, companyId);
        await this.audit.record(
          {
            action: 'employee.invited',
            target: { type: 'user', id: user.id },
            metadata: { email: user.email },
          },
          manager,
        );
        return user;
      });
    } catch (error) {
      // `(companyId, email)` is unique; the constraint settles a race, and also
      // catches inviting someone who was removed earlier.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'Someone with that email is already in this company. If they were removed, reactivate them instead.',
        );
      }
      throw error;
    }
  }

  async list(query: EmployeesQueryDto): Promise<OffsetPage<User>> {
    const companyId = this.context.requireCompanyId();

    const qb = this.tenantScope.forCompany(this.dataSource.getRepository(User), companyId, 'u');
    // Filters only ever narrow what the tenant scope already allows.
    if (query.status) qb.andWhere('u.status = :status', { status: query.status });
    if (query.role) qb.andWhere('u.role = :role', { role: query.role });

    const [rows, total] = await qb
      .orderBy('u.createdAt', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return toOffsetPage(rows, total, query.page, query.limit);
  }

  /** Issues a fresh invitation, superseding the previous link. Only for someone still `invited`. */
  async resendInvite(id: string): Promise<User> {
    const companyId = this.context.requireCompanyId();

    return this.dataSource.transaction(async (manager) => {
      const target = await this.findInCompany(manager, companyId, id);
      if (target.status !== 'invited') {
        throw new ConflictException('Only a pending invitation can be resent.');
      }

      await this.sendInvite(manager, target, companyId);
      await this.audit.record(
        { action: 'employee.invite_resent', target: { type: 'user', id: target.id } },
        manager,
      );
      return target;
    });
  }

  /**
   * "Delete" an employee = soft-disable (D7). Their uploaded files stay with the
   * company; what stops is access and billing: the seat is freed and proration
   * ends today, every session is revoked, login identities are removed, and any
   * outstanding invite or reset link is spent. Removing them here rather than
   * relying on `status` alone means nothing that only checks a token or an
   * identity can resurrect them.
   *
   * Later phases hook in here: file grants (Phase 6) and API keys (Phase 10).
   */
  async disable(id: string): Promise<User> {
    const companyId = this.context.requireCompanyId();

    return this.dataSource.transaction(async (manager) => {
      const target = await this.findInCompany(manager, companyId, id);
      if (target.id === this.context.userId) {
        throw new BadRequestException('You cannot remove yourself.');
      }
      if (target.role !== 'employee') {
        throw new BadRequestException('Only employees can be removed; an admin account cannot.');
      }
      if (target.status === 'disabled') {
        throw new ConflictException('This employee has already been removed.');
      }

      const now = this.clock.now();
      await manager.update(User, { id: target.id }, { status: 'disabled', disabledAt: now });

      // The seat interval is what billing reads: close it, and proration stops today.
      await manager
        .createQueryBuilder()
        .update(SeatInterval)
        .set({ activeTo: now })
        .where('"userId" = :userId AND "activeTo" IS NULL', { userId: target.id })
        .execute();

      await manager.delete(AuthIdentity, { userId: target.id });
      await this.sessions.revokeAllForUser(manager, target.id);
      await manager
        .createQueryBuilder()
        .update(AuthToken)
        .set({ consumedAt: now })
        .where('"userId" = :userId AND "consumedAt" IS NULL', { userId: target.id })
        .execute();

      await this.audit.record(
        { action: 'employee.disabled', target: { type: 'user', id: target.id } },
        manager,
      );
      return manager.findOneOrFail(User, { where: { id: target.id } });
    });
  }

  /**
   * Brings a removed employee back. Their login identity was deleted when they
   * were removed, so this is a fresh invitation: they become `invited` (holding
   * a seat again, so the cap is re-checked) and set a password when they accept.
   */
  async reactivate(id: string): Promise<User> {
    const companyId = this.context.requireCompanyId();

    return this.dataSource.transaction(async (manager) => {
      const subscription = await this.subscriptions.lockForUpdate(manager, companyId);
      if (!subscription) throw new HttpException(NO_PLAN, HttpStatus.PAYMENT_REQUIRED);

      const target = await this.findInCompany(manager, companyId, id);
      if (target.status !== 'disabled') {
        throw new ConflictException('Only a removed employee can be reactivated.');
      }

      const problem = seatCapProblem(
        subscription.plan,
        await this.subscriptions.employeeSeatsHeld(manager, companyId),
      );
      if (problem) throw new ConflictException(problem);

      await manager.update(User, { id: target.id }, { status: 'invited', disabledAt: null });
      const fresh = await manager.findOneOrFail(User, { where: { id: target.id } });

      await this.sendInvite(manager, fresh, companyId);
      await this.audit.record(
        { action: 'employee.reactivated', target: { type: 'user', id: target.id } },
        manager,
      );
      return fresh;
    });
  }

  private async findInCompany(manager: EntityManager, companyId: string, id: string): Promise<User> {
    const user = await this.tenantScope
      .forCompany(manager.getRepository(User), companyId, 'u')
      .andWhere('u.id = :id', { id })
      .getOne();
    // Another company's user is indistinguishable from one that does not exist.
    if (!user) throw new NotFoundException('Employee not found');
    return user;
  }

  /** Issues an invite token (superseding older ones) and queues the email, in the caller's transaction. */
  private async sendInvite(manager: EntityManager, user: User, companyId: string): Promise<void> {
    const company = await manager.findOneOrFail(Company, { where: { id: companyId } });
    const token = await this.authTokens.issue(manager, user.id, 'invite', INVITE_TOKEN_TTL_MS);

    await this.queue.enqueue(
      'send_email',
      {
        template: 'invite',
        to: user.email,
        vars: {
          fullName: user.fullName,
          companyName: company.name,
          inviteUrl: appLink(this.config.APP_PUBLIC_URL, '/accept-invite', token),
        },
      },
      { manager },
    );
  }
}
