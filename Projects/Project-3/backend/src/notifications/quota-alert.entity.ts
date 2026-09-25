import { Column, Entity, JoinColumn, ManyToOne, type Relation, Unique } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';

/**
 * "This company has been told it passed N% of its file quota in this period." The unique key is
 * what makes each alert fire once per period: the insert that wins the `ON CONFLICT DO NOTHING`
 * sends the notification and the email, and every other upload finds the row already there.
 * It also serves as the tenant index (it leads with `companyId`).
 */
@Entity({ name: 'quota_alert' })
@Unique('uq_quota_alert_company_period_threshold', ['companyId', 'periodKey', 'threshold'])
export class QuotaAlert extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'text' })
  periodKey!: string;

  @Column({ type: 'int' })
  threshold!: number;
}
