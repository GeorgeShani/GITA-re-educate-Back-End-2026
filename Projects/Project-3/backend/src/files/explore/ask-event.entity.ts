import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';

/**
 * One plain-language question answered with the AI assistant: what the plan's `questionsPerPeriod` counts. Only a question the
 * model actually planned is recorded (an AI that is off, down, or declined to answer costs nothing), and it records WHO asked and
 * of which file, never the question's words or any answer.
 */
@Entity({ name: 'ask_event' })
@Index('idx_ask_event_company_time', ['companyId', 'createdAt'])
export class AskEvent extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid' })
  fileId!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;
}
