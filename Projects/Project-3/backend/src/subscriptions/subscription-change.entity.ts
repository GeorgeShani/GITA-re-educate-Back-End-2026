import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { PLANS, type Plan } from './plan-catalog.js';
import { SUBSCRIPTION_PLAN_ENUM } from './subscription.entity.js';

/**
 * Append-only history: the first choice (`fromPlan` null) and every switch
 * after. `prorationCents` is the total of the invoice that closed the outgoing
 * period (0 when there was nothing to bill), so plan history can be joined to
 * money without recomputing it. Leading with `companyId`, per the tenant-index
 * rule; `effectiveAt` orders the history.
 */
@Entity({ name: 'subscription_change' })
@Index('idx_subscription_change_company_effective', ['companyId', 'effectiveAt'])
export class SubscriptionChange extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'enum', enum: PLANS, enumName: SUBSCRIPTION_PLAN_ENUM, nullable: true })
  fromPlan!: Plan | null;

  @Column({ type: 'enum', enum: PLANS, enumName: SUBSCRIPTION_PLAN_ENUM })
  toPlan!: Plan;

  @Column({ type: 'timestamptz' })
  effectiveAt!: Date;

  @Column({ type: 'int', default: 0 })
  prorationCents!: number;
}
