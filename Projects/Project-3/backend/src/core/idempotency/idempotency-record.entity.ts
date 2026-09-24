import { Column, Entity, JoinColumn, ManyToOne, type Relation, Unique } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';

export const IDEMPOTENCY_STATUSES = ['in_progress', 'completed'] as const;
export type IdempotencyStatus = (typeof IDEMPOTENCY_STATUSES)[number];

/**
 * One row per `Idempotency-Key` a company has used. The row is inserted BEFORE the
 * side effect runs (that insert is the claim that stops two identical requests both
 * running) and completed with the response afterwards, so a retry of a request that
 * already happened replays the stored answer instead of charging or counting twice.
 *
 * `UNIQUE (companyId, key)` is the tenant-leading index the lookup uses. `jsonb`
 * columns are read back through Zod, like every other `jsonb` here.
 */
@Entity({ name: 'idempotency_record' })
@Unique('uq_idempotency_company_key', ['companyId', 'key'])
export class IdempotencyRecord extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'text' })
  key!: string;

  /** `POST /files` — the same key on a different route is a different request. */
  @Column({ type: 'text' })
  route!: string;

  @Column({ type: 'text' })
  requestHash!: string;

  @Column({
    type: 'enum',
    enum: IDEMPOTENCY_STATUSES,
    enumName: 'idempotency_status',
    default: 'in_progress',
  })
  status!: IdempotencyStatus;

  @Column({ type: 'int', nullable: true })
  statusCode!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  responseBody!: unknown;

  /** Only the `X-Gridline-*` headers a handler set, so they replay too. */
  @Column({ type: 'jsonb', nullable: true })
  responseHeaders!: unknown;
}
