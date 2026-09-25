import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';

/**
 * A data-quality rule a company defines once and every upload is checked against. `kind` and
 * `severity` are plain text (a closed vocabulary in code, like an audit action, so a new kind costs no
 * `ALTER TYPE`) and `params` is `jsonb`: read back through `ruleSpecSchema`, never trusted.
 *
 * `columnName` is what the company typed; it is matched to a file's columns case-insensitively and
 * is null for a file-level rule (`max_duplicate_rows`). Deleting a rule does not touch old reports:
 * each report stored a snapshot of the rule as it was.
 */
@Entity({ name: 'quality_rule' })
@Index('idx_quality_rule_company', ['companyId', 'createdAt'])
export class QualityRule extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  columnName!: string | null;

  @Column({ type: 'text' })
  kind!: string;

  @Column({ type: 'jsonb' })
  params!: unknown;

  @Column({ type: 'text' })
  severity!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy?: Relation<User>;

  @Column({ type: 'uuid' })
  createdByUserId!: string;
}
