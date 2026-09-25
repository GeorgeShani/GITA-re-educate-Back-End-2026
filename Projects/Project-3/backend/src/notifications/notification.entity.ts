import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';

/**
 * One person's inbox entry. `type` and `payload` are validated against
 * `notificationContentSchema` when written and parsed through it when read.
 *
 * The composite index leads with `companyId` like every tenant table and then `userId`, because a
 * person only ever reads their own rows (newest first, which the index serves by a backward scan).
 * Read rows are purged after 90 days; unread ones stay until read.
 */
@Entity({ name: 'notification' })
@Index('idx_notification_company_user_created', ['companyId', 'userId', 'createdAt', 'id'])
export class Notification extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'jsonb' })
  payload!: unknown;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;
}
