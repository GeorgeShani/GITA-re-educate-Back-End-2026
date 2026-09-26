import { Column, Entity, Index, JoinColumn, OneToOne, type Relation, VersionColumn } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { PLANS, type Plan } from '#/subscriptions/plan-catalog.js';
import { SUBSCRIPTION_PLAN_ENUM } from '#/subscriptions/subscription.entity.js';

export const BILLING_ACCOUNT_STATUSES = ['current', 'past_due', 'cancelled'] as const;
export type BillingAccountStatus = (typeof BILLING_ACCOUNT_STATUSES)[number];

@Entity({ name: 'billing_account' })
export class BillingAccount extends BaseEntity {
  @OneToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Index({ unique: true })
  @Column({ type: 'text', nullable: true })
  stripeCustomerId!: string | null;

  @Index({ unique: true })
  @Column({ type: 'text', nullable: true })
  stripeSubscriptionId!: string | null;

  @Column({ type: 'text', nullable: true })
  stripeSeatItemId!: string | null;

  @Column({ type: 'enum', enum: BILLING_ACCOUNT_STATUSES, enumName: 'billing_account_status', default: 'current' })
  status!: BillingAccountStatus;

  @Column({ type: 'timestamptz', nullable: true })
  graceEndsAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  pendingIntentId!: string | null;

  @Column({ type: 'text', nullable: true })
  pendingCheckoutSessionId!: string | null;

  @Column({ type: 'enum', enum: PLANS, enumName: SUBSCRIPTION_PLAN_ENUM, nullable: true })
  pendingPlan!: Plan | null;

  @Column({ type: 'timestamptz', nullable: true })
  pendingCreatedAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  seatRevision!: number;

  @VersionColumn()
  version!: number;
}
