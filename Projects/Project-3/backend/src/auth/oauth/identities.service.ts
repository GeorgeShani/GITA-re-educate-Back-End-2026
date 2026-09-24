import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '#/core/audit/audit.service.js';
import { AuthIdentity } from '#/database/entities/auth-identity.entity.js';

/** "Settings → Linked accounts": how the signed-in user can prove who they are. */
@Injectable()
export class IdentitiesService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  list(userId: string): Promise<AuthIdentity[]> {
    return this.dataSource.getRepository(AuthIdentity).find({
      where: { userId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }

  /**
   * Removes one of the caller's own identities. Refused if it is the last: a user
   * with no way to sign in is locked out with nobody able to fix it but a DBA.
   *
   * The identity rows are locked for the duration, so two "unlink" requests for
   * different identities cannot each see "another one remains" and together
   * remove them all.
   */
  async unlink(userId: string, identityId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const identities = await manager.find(AuthIdentity, {
        where: { userId },
        lock: { mode: 'pessimistic_write' },
      });

      // Somebody else's identity is indistinguishable from one that does not exist.
      const target = identities.find((identity) => identity.id === identityId);
      if (!target) throw new NotFoundException('Identity not found');
      if (identities.length <= 1) {
        throw new ConflictException(
          'This is your only way to sign in. Link another one before removing it.',
        );
      }

      await manager.delete(AuthIdentity, { id: target.id });
      await this.audit.record(
        {
          action: 'auth.identity_unlinked',
          target: { type: 'user', id: userId },
          metadata: { provider: target.provider },
        },
        manager,
      );
    });
  }
}
