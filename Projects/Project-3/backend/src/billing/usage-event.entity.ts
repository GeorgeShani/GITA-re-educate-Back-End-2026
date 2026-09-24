import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';

/**
 * One unit of quota per successful upload. `periodKey` is the billing period's
 * start date (`YYYY-MM-DD`), so "how many files this period" is an equality
 * lookup on the index below: the hot path for both the per-upload quota check
 * and the billing rollup.
 *
 * `fileId` is a plain column for now; Phase 6 adds the foreign key once
 * `file_asset` exists, and starts writing events.
 */
@Entity({ name: 'usage_event' })
@Index('idx_usage_event_company_period', ['companyId', 'periodKey'])
export class UsageEvent extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid' })
  fileId!: string;

  @Column({ type: 'text' })
  periodKey!: string;
}
