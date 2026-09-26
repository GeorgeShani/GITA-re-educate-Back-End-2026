import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { PLANS, type Plan } from '#/subscriptions/plan-catalog.js';
import { SUBSCRIPTION_PLAN_ENUM } from '#/subscriptions/subscription.entity.js';

export const INVOICE_STATUSES = ['finalized', 'draft', 'open', 'paid', 'uncollectible', 'void'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_PROVIDERS = ['local', 'stripe'] as const;
export type InvoiceProvider = (typeof INVOICE_PROVIDERS)[number];

/**
 * Immutable once written. There is no payment integration, so `finalized` is the
 * only state; `paid`/`void` would be added with one, by migration.
 *
 * `@Unique(['companyId', 'periodStart'])` is what makes the rollover job
 * idempotent (a second run for the same period fails the constraint instead of
 * double-billing) and, leading with `companyId`, is also the tenant index for
 * listing a company's invoices.
 *
 * `lineItems` is `jsonb` and deliberately unindexed: read only by primary key,
 * never queried into. What comes back is untyped, so it is parsed with
 * `lineItemsSchema` before anything uses it.
 */
@Entity({ name: 'invoice' })
@Index('idx_invoice_local_period_unique', { synchronize: false })
export class Invoice extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  /** The plan this invoice bills: the one that was live during the period. */
  @Column({ type: 'enum', enum: PLANS, enumName: SUBSCRIPTION_PLAN_ENUM })
  plan!: Plan;

  @Column({ type: 'timestamptz' })
  periodStart!: Date;

  /** Where billing stopped: the period end, or the switch day if a plan change closed it early. */
  @Column({ type: 'timestamptz' })
  periodEnd!: Date;

  @Column({ type: 'jsonb' })
  lineItems!: unknown;

  @Column({ type: 'int' })
  totalCents!: number;

  @Column({
    type: 'enum',
    enum: INVOICE_STATUSES,
    enumName: 'invoice_status',
    default: 'finalized',
  })
  status!: InvoiceStatus;

  @Column({ type: 'timestamptz' })
  dueDate!: Date;

  @Column({ type: 'enum', enum: INVOICE_PROVIDERS, enumName: 'invoice_provider', default: 'local' })
  provider!: InvoiceProvider;

  @Index({ unique: true })
  @Column({ type: 'text', nullable: true })
  stripeInvoiceId!: string | null;

  @Column({ type: 'text', nullable: true })
  stripeHostedInvoiceUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  stripeInvoicePdfUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  currency!: string | null;

  @Column({ type: 'int', default: 0 })
  paymentAttempts!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastPaymentAttemptAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt!: Date | null;
}
