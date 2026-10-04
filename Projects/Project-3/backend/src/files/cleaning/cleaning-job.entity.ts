import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';

export const CLEANING_JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed'] as const;
export type CleaningJobStatus = (typeof CLEANING_JOB_STATUSES)[number];

/**
 * One request to clean a file: the recipe, who asked, and how it went. The cleaned data is a NEW version of the file's dataset
 * (`resultFileId`); this row is what the page waits on while it is being made, and the record of what was done to the data.
 *
 * `recipe` and `steps` are `jsonb`, read back through their Zod schemas, never trusted. `trigger` says whether a person asked
 * or a dataset's saved "clean every new version" setting did.
 */
@Entity({ name: 'cleaning_job' })
@Index('idx_cleaning_job_company', ['companyId', 'createdAt'])
@Index('idx_cleaning_job_file', ['fileId'])
export class CleaningJob extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  /** The version that is being cleaned. */
  @Column({ type: 'uuid' })
  fileId!: string;

  @Column({ type: 'uuid' })
  requestedByUserId!: string;

  @Column({ type: 'text' })
  trigger!: 'manual' | 'auto';

  @Column({ type: 'jsonb' })
  recipe!: unknown;

  /** The worksheet of a workbook to clean; null for a CSV or the first sheet. */
  @Column({ type: 'text', nullable: true })
  sheet!: string | null;

  @Column({ type: 'text', default: 'queued' })
  status!: CleaningJobStatus;

  /** The new version, once it exists. */
  @Column({ type: 'uuid', nullable: true })
  resultFileId!: string | null;

  /** What each step did, once it has run. */
  @Column({ type: 'jsonb', nullable: true })
  steps!: unknown;

  @Column({ type: 'integer', nullable: true })
  rowsBefore!: number | null;

  @Column({ type: 'integer', nullable: true })
  rowsAfter!: number | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;
}
