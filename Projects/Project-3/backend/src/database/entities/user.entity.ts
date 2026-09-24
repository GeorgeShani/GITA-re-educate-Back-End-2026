import { Column, Entity, JoinColumn, ManyToOne, type Relation, Unique } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from './company.entity.js';

export const USER_ROLES = ['admin', 'employee'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['invited', 'active', 'disabled'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Holds no credentials — see `AuthIdentity`. `email` here is the *contact*
 * address invites and notices are sent to, unique per company rather than
 * globally: the same person's email could plausibly belong to two companies.
 *
 * `status` doubles as the billing-seat state the billing calculator (later
 * milestone) reads: `invited` occupies a seat but is not billed; `active`
 * bills by the day from `activatedAt`; `disabled` frees the seat immediately
 * from `disabledAt`.
 *
 * `@Unique(['companyId', 'email'])` is also the tenant-scoped composite index
 * this table needs — a leading `companyId` column serves both the uniqueness
 * check and any query filtering on tenant alone, so no separate index is added.
 */
@Entity({ name: 'user' })
@Unique(['companyId', 'email'])
export class User extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text' })
  fullName!: string;

  @Column({ type: 'enum', enum: USER_ROLES, enumName: 'user_role' })
  role!: UserRole;

  @Column({
    type: 'enum',
    enum: USER_STATUSES,
    enumName: 'user_status',
    default: 'invited',
  })
  status!: UserStatus;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;
}
