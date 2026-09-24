import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';

/**
 * Immutable — no update/delete path exists in code, and the migration adds a
 * trigger that makes Postgres itself refuse `UPDATE`/`DELETE` (TRUNCATE is
 * unaffected, so test resets still work).
 *
 * `action` and `targetType` are plain text, not Postgres enums, unlike the
 * `status`/`type` columns elsewhere: every feature phase adds new actions, and
 * an enum would mean an `ALTER TYPE` migration per phase for a vocabulary
 * that is open-ended by nature. The allowed values live in `AuditAction`.
 *
 * `actorUserId` has no foreign key on purpose: a disabled employee's rows
 * must keep resolving, and a cascade would break immutability (decision D7).
 *
 * The composite index is the keyset index for `GET /audit`, leading with
 * `companyId` like every tenant-scoped table.
 */
@Entity({ name: 'audit_log_entry' })
@Index('idx_audit_log_company_created', ['companyId', 'createdAt', 'id'])
export class AuditLogEntry extends BaseEntity {
  @Column({ type: 'uuid' })
  companyId!: string;

  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text', nullable: true })
  targetType!: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  ip!: string | null;

  @Column({ type: 'text', nullable: true })
  correlationId!: string | null;
}
