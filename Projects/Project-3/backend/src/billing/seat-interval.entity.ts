import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { User } from '#/database/entities/user.entity.js';

/**
 * A stretch of time an employee occupied a BILLABLE seat: `activeFrom`
 * inclusive to `activeTo` exclusive, `activeTo` null while still active. This
 * is what the billing calculator reads.
 *
 * Its own table, not derived from `User.activatedAt/disabledAt`: those two
 * columns hold one interval, so disabling and later reactivating an employee
 * would overwrite the first stretch and silently under-bill it. Employee
 * lifecycle (accept invite, disable) opens and closes rows here; an invited
 * user has none, because an invite holds a seat but bills $0 (D4).
 *
 * Leads with `companyId` for the overlap query ("intervals touching this
 * period"), per the tenant-index rule; `userId` serves "close this user's
 * open one".
 */
@Entity({ name: 'seat_interval' })
@Index('idx_seat_interval_company_from', ['companyId', 'activeFrom'])
export class SeatInterval extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'timestamptz' })
  activeFrom!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  activeTo!: Date | null;
}
