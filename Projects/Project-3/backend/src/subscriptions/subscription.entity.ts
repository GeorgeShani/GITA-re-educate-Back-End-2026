import { Column, Entity, JoinColumn, ManyToOne, type Relation, Unique, VersionColumn } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { PLANS, type Plan } from './plan-catalog.js';

/** Shared by `Subscription.plan`, `SubscriptionChange`, and `Invoice.plan`. */
export const SUBSCRIPTION_PLAN_ENUM = 'subscription_plan';

/**
 * One live row per company. `@Unique(['companyId'])` is both that guarantee and
 * the tenant-leading index this table needs.
 *
 * `@VersionColumn` backs up the row lock plan changes take: even if a code path
 * forgot `FOR UPDATE`, two interleaving writers would collide on the version
 * instead of silently overwriting each other.
 */
@Entity({ name: 'subscription' })
@Unique(['companyId'])
export class Subscription extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'enum', enum: PLANS, enumName: SUBSCRIPTION_PLAN_ENUM })
  plan!: Plan;

  /** Half-open `[start, end)`, both UTC midnights. */
  @Column({ type: 'timestamptz' })
  currentPeriodStart!: Date;

  @Column({ type: 'timestamptz' })
  currentPeriodEnd!: Date;

  /** Day of the month (1-31) the period rolls over on; the activation day (D6). */
  @Column({ type: 'int' })
  billingAnchorDay!: number;

  @VersionColumn()
  version!: number;
}
