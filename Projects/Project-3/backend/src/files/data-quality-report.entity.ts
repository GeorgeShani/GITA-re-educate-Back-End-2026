import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { FileAsset } from './file-asset.entity.js';
import type { RuleResult } from './quality/rules.js';

/**
 * `queued`      the upload committed; the task has not started (the row exists from the upload)
 * `profiling`   a worker is reading the file
 * `ready`       metrics (and, if an AI provider is configured, a narrative) are there
 * `unsupported` stored, but a format Gridline does not profile (legacy `.xls`)
 * `failed`      the file could not be read (corrupt, too large to open safely) — or a
 *               transient error the task queue is retrying, which clears itself on success
 */
export const REPORT_STATUSES = ['queued', 'profiling', 'ready', 'unsupported', 'failed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/**
 * One report per file (`UNIQUE (fileId)`). Created `queued` in the upload's own
 * transaction, so `GET /files/:id/report` never answers 404 for a file that exists.
 *
 * `metrics`, `recommendations` and `previewRows` are `jsonb`: untyped by definition, so
 * every read goes through the Zod schemas in `quality/`. The preview (first rows) is
 * stored at profile time so the preview endpoint never parses an untrusted file inside a
 * request.
 */
@Entity({ name: 'data_quality_report' })
@Index('idx_data_quality_report_company_status', ['companyId', 'status'])
export class DataQualityReport extends BaseEntity {
  @ManyToOne(() => FileAsset, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fileId' })
  file?: Relation<FileAsset>;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  fileId!: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({
    type: 'enum',
    enum: REPORT_STATUSES,
    enumName: 'data_quality_report_status',
    default: 'queued',
  })
  status!: ReportStatus;

  @Column({ type: 'jsonb', nullable: true })
  metrics!: unknown;

  @Column({ type: 'text', nullable: true })
  summaryText!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  recommendations!: string[] | null;

  /** The model that wrote the narrative; null when there is none. */
  @Column({ type: 'text', nullable: true })
  model!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  previewRows!: unknown;

  /**
   * How the file did against the company's rules, each result carrying a snapshot of its rule
   * (`ruleResultSchema`). Null until profiled, and after a profile with no rules to apply.
   */
  @Column({ type: 'jsonb', nullable: true })
  ruleResults!: RuleResult[] | null;

  /** Share of applicable rules passed, 0–100 (an error counts double); null when none applied. */
  @Column({ type: 'int', nullable: true })
  qualityScore!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  profiledAt!: Date | null;
}
