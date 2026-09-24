import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SeatInterval } from '#/billing/seat-interval.entity.js';
import { AuditService } from '#/core/audit/audit.service.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';
import { User } from '#/database/entities/user.entity.js';
import { isUniqueViolation } from '#/database/pg-errors.js';
import { AuthTokenService } from './auth-token.service.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import type { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { type Session, SessionService } from './session.service.js';

const INVALID = 'This invitation is invalid or has expired. Ask your admin to send a new one.';

@Injectable()
export class InviteAcceptanceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly authTokens: AuthTokenService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Spends the invitation, sets the employee's password, and signs them in.
   *
   * The invite token IS the proof of who this is — possession of the emailed link
   * — so nothing here compares emails. This is also the moment **billing starts**:
   * an `invited` user held a seat but billed $0 (D4); the `seat_interval` row
   * opened below is what the calculator bills from.
   */
  async accept(dto: AcceptInviteDto, meta: { userAgent: string | undefined }): Promise<Session> {
    // scrypt is deliberately slow: do it before opening the transaction.
    const passwordHash = await this.hasher.hash(dto.password);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const userId = await this.authTokens.consume(manager, 'invite', dto.token);
        if (!userId) throw new BadRequestException(INVALID);

        const user = await manager.findOneOrFail(User, {
          where: { id: userId },
          relations: { company: true },
        });
        // Removed after the invite was sent (their tokens are spent on removal, so
        // this is belt and braces), or their company is no longer active.
        if (user.status !== 'invited' || user.company?.status !== 'active') {
          throw new BadRequestException(INVALID);
        }

        const now = this.clock.now();
        await manager.update(
          User,
          { id: user.id },
          { status: 'active', activatedAt: now, disabledAt: null },
        );
        await manager.insert(AuthIdentity, {
          userId: user.id,
          provider: 'password',
          // The provider's stable subject: the user's own id, never the email.
          providerUserId: user.id,
          email: user.email,
          // They proved they can read this address by using the emailed link.
          emailVerified: true,
          passwordHash,
          lastUsedAt: now,
        });
        if (user.role === 'employee') {
          await manager.insert(SeatInterval, {
            companyId: user.companyId,
            userId: user.id,
            activeFrom: now,
            activeTo: null,
          });
        }

        await this.audit.record(
          {
            action: 'employee.accepted_invite',
            companyId: user.companyId,
            actorUserId: user.id,
            target: { type: 'user', id: user.id },
          },
          manager,
        );

        return this.sessions.startSession(manager, user.id, randomUUID(), meta);
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An account with this email address already exists.');
      }
      throw error;
    }
  }
}
