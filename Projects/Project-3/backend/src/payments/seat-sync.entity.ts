import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation, Unique } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';

export const SEAT_SYNC_STATUSES = ['pending', 'succeeded'] as const;
export type SeatSyncStatus = (typeof SEAT_SYNC_STATUSES)[number];

@Entity({ name: 'seat_sync' })
@Unique(['companyId', 'sequence'])
@Index('idx_seat_sync_company_status_sequence', ['companyId', 'status', 'sequence'])
export class SeatSync extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'int' })
  sequence!: number;

  @Column({ type: 'int' })
  activeEmployees!: number;

  @Column({ type: 'timestamptz' })
  effectiveAt!: Date;

  @Column({ type: 'enum', enum: SEAT_SYNC_STATUSES, enumName: 'seat_sync_status', default: 'pending' })
  status!: SeatSyncStatus;

  @Column({ type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;
}
