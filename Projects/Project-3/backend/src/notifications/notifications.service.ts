import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { DataSource, type EntityManager } from 'typeorm';
import { decodeCursor } from '#/common/pagination/cursor.js';
import { applyCursor, toCursorPage } from '#/common/pagination/paginate.js';
import type { CursorPage } from '#/common/pagination/paginated-result.js';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { User } from '#/database/entities/user.entity.js';
import { TenantScope } from '#/database/tenant-scope.js';
import type { NotificationsQueryDto } from './dto/notifications-query.dto.js';
import type { NotificationContent } from './notification-content.js';
import { Notification } from './notification.entity.js';
import { type NotificationView, viewOf } from './notification-view.js';

/**
 * The inbox. Producers call `notify` / `notifyAdmins` INSIDE the transaction that caused the thing to
 * happen, so a notification exists only if the change committed — and the realtime push
 * (`NotificationBroadcaster`) goes out only after that commit. Marking one read is personal inbox
 * state, not a company action, so it is deliberately not audited.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScope,
    private readonly context: RequestContextService,
    private readonly logger: PinoLogger,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.logger.setContext(NotificationsService.name);
  }

  // ---- producers ---------------------------------------------------------------

  /**
   * One notification per ACTIVE member of `userIds` (a removed person's inbox is not written to).
   * Recipients are checked against the company, so a caller cannot notify someone in another tenant.
   */
  async notify(
    manager: EntityManager,
    companyId: string,
    userIds: readonly string[],
    content: NotificationContent,
  ): Promise<number> {
    const wanted = [...new Set(userIds)];
    if (wanted.length === 0) return 0;

    const recipients = await this.tenantScope
      .forCompany(manager.getRepository(User), companyId, 'u')
      .andWhere('u.id IN (:...wanted)', { wanted })
      .andWhere("u.status = 'active'")
      .select('u.id')
      .getMany();
    if (recipients.length === 0) return 0;

    // `save`, not `insert`: inside a transaction both work, but only `save` also opens (and
    // commits) a transaction of its own when there is none, which is what releases the push.
    await manager.save(
      recipients.map((user) =>
        manager.create(Notification, {
          companyId,
          userId: user.id,
          type: content.type,
          payload: content.payload,
          readAt: null,
        }),
      ),
    );
    return recipients.length;
  }

  /** Every active admin of the company. */
  async notifyAdmins(manager: EntityManager, companyId: string, content: NotificationContent): Promise<number> {
    return this.notify(manager, companyId, await this.activeAdminIds(manager, companyId), content);
  }

  async activeAdminIds(manager: EntityManager, companyId: string): Promise<string[]> {
    const admins = await this.tenantScope
      .forCompany(manager.getRepository(User), companyId, 'u')
      .andWhere("u.role = 'admin' AND u.status = 'active'")
      .select('u.id')
      .getMany();
    return admins.map((admin) => admin.id);
  }

  // ---- the caller's own inbox ----------------------------------------------------

  /** Newest first, keyset-paginated. Only ever the caller's own rows. */
  async list(query: NotificationsQueryDto): Promise<CursorPage<NotificationView>> {
    const qb = this.mine('n');
    if (query.unread) qb.andWhere('n.readAt IS NULL');

    applyCursor(qb, 'n', query.cursor ? decodeCursor(query.cursor) : undefined, 'DESC');
    const page = await toCursorPage(qb, query.limit);

    const data: NotificationView[] = [];
    for (const row of page.data) {
      const view = viewOf(row);
      if (view) data.push(view);
      else this.logger.warn({ notificationId: row.id, type: row.type }, 'Skipping a notification that no longer parses');
    }
    return { data, meta: page.meta };
  }

  async unreadCount(): Promise<number> {
    return this.mine('n').andWhere('n.readAt IS NULL').getCount();
  }

  /** Idempotent: reading a read notification changes nothing. Someone else's is a 404. */
  async markRead(id: string): Promise<NotificationView> {
    const row = await this.mine('n').andWhere('n.id = :id', { id }).getOne();
    if (!row) throw new NotFoundException('Notification not found');

    if (!row.readAt) {
      row.readAt = this.clock.now();
      await this.dataSource.getRepository(Notification).update({ id: row.id }, { readAt: row.readAt });
    }
    const view = viewOf(row);
    if (!view) throw new NotFoundException('Notification not found');
    return view;
  }

  async markAllRead(): Promise<number> {
    const result = await this.dataSource
      .getRepository(Notification)
      .createQueryBuilder()
      .update()
      .set({ readAt: this.clock.now() })
      .where('"companyId" = :companyId AND "userId" = :userId AND "readAt" IS NULL', {
        companyId: this.context.requireCompanyId(),
        userId: this.context.requireUserId(),
      })
      .execute();
    return result.affected ?? 0;
  }

  /** The tenant scope, then the person: nobody reads another person's inbox, admin or not. */
  private mine(alias: string) {
    return this.tenantScope
      .forCompany(this.dataSource.getRepository(Notification), this.context.requireCompanyId(), alias)
      .andWhere(`${alias}.userId = :mineUserId`, { mineUserId: this.context.requireUserId() });
  }
}
