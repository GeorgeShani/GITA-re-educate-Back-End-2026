import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';

/**
 * Every task type has exactly one registered handler with a Zod payload
 * schema. Adding a type means adding it here, a migration
 * (`ALTER TYPE background_task_type ADD VALUE`), and a handler.
 */
export const BACKGROUND_TASK_TYPES = ['send_email', 'build_data_quality_report'] as const;
export type BackgroundTaskType = (typeof BACKGROUND_TASK_TYPES)[number];

export const BACKGROUND_TASK_STATUSES = ['pending', 'running', 'succeeded', 'dead'] as const;
export type BackgroundTaskStatus = (typeof BACKGROUND_TASK_STATUSES)[number];

/**
 * The durable job queue — not an event bus. It exists for a handful of jobs
 * that must survive a restart (send email, build a report), claimed with
 * `FOR UPDATE SKIP LOCKED` so concurrent runners never take the same row.
 *
 * `payload` is `jsonb` and deliberately unindexed: it is read only by primary
 * key, never queried into. What comes back out is untyped by definition, so
 * the handler's Zod schema parses it before anything runs.
 */
@Entity({ name: 'background_task' })
@Index('idx_background_task_status_run_after', ['status', 'runAfter'])
export class BackgroundTask extends BaseEntity {
  @Column({ type: 'enum', enum: BACKGROUND_TASK_TYPES, enumName: 'background_task_type' })
  type!: BackgroundTaskType;

  @Column({ type: 'jsonb' })
  payload!: unknown;

  @Column({
    type: 'enum',
    enum: BACKGROUND_TASK_STATUSES,
    enumName: 'background_task_status',
    default: 'pending',
  })
  status!: BackgroundTaskStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ type: 'timestamptz' })
  runAfter!: Date;

  @Column({ type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lockedAt!: Date | null;

  /** The request that queued this, so the runner's logs correlate with it. */
  @Column({ type: 'text', nullable: true })
  correlationId!: string | null;
}
