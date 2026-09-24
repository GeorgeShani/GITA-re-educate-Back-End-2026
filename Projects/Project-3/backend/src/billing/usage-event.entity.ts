import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { FileAsset } from '#/files/file-asset.entity.js';

/**
 * One unit of quota per successful upload. `periodKey` is the billing period's
 * start date (`YYYY-MM-DD`), so "how many files this period" is an equality
 * lookup on the index below: the hot path for both the per-upload quota check
 * and the billing rollup.
 *
 * `fileId` is a real foreign key. Files are only ever soft-deleted, so an event
 * never dangles — and deleting a file deliberately does NOT refund its quota: an
 * upload counted when it happened.
 */
@Entity({ name: 'usage_event' })
@Index('idx_usage_event_company_period', ['companyId', 'periodKey'])
export class UsageEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => FileAsset)
  @JoinColumn({ name: 'fileId' })
  file?: Relation<FileAsset>;

  @Column({ type: 'uuid' })
  fileId!: string;

  @Column({ type: 'text' })
  periodKey!: string;
}
