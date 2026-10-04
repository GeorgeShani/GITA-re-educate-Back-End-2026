import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';

export const VERSION_DIFF_STATUSES = ['queued', 'running', 'ready', 'failed'] as const;
export type VersionDiffStatus = (typeof VERSION_DIFF_STATUSES)[number];

/**
 * The row-by-row comparison of two versions of one dataset, matched by `keyColumns`. One row per pair: asking again with other
 * keys replaces it. `summary` and `sample` are `jsonb`, read back through their schemas, never trusted; the full list of changes
 * is not stored (it can be as long as the data) and is rebuilt for the download.
 */
@Entity({ name: 'version_diff' })
@Index('uq_version_diff_pair', ['companyId', 'fromFileId', 'toFileId'], { unique: true })
export class VersionDiff extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  /** The older version. */
  @Column({ type: 'uuid' })
  fromFileId!: string;

  /** The newer version. */
  @Column({ type: 'uuid' })
  toFileId!: string;

  @Column({ type: 'jsonb' })
  keyColumns!: string[];

  @Column({ type: 'text' })
  trigger!: 'manual' | 'auto';

  @Column({ type: 'text', default: 'queued' })
  status!: VersionDiffStatus;

  @Column({ type: 'jsonb', nullable: true })
  summary!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  sample!: unknown;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;
}
