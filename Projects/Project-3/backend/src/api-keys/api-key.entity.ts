import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import type { ApiScope } from '#/common/auth/require-scopes.decorator.js';
import { BaseEntity } from '#/database/base.entity.js';
import { Company } from '#/database/entities/company.entity.js';
import { User } from '#/database/entities/user.entity.js';

/**
 * A personal API key. Only the SHA-256 of the token is stored — the plaintext is shown
 * once, at creation — and `prefix` (`gl_live_ab12cd34`) is the non-secret handle a person
 * uses to tell their keys apart.
 *
 * A key holds NO permissions of its own beyond `scopes`: on every request it acts as its
 * creator (`createdByUserId`) with that person's LIVE role and status, narrowed to these
 * scopes. So disabling the creator kills the key at once, whatever this row says.
 *
 * Indexes: `keyHash` is the lookup on every key request (unique); the two composites lead
 * with `companyId` like every tenant table — one serves the admin's list, the other "this
 * person's keys" (own-keys list, and revoking them when an employee is removed).
 */
@Entity({ name: 'api_key' })
@Index('idx_api_key_company_created', ['companyId', 'createdAt'])
@Index('idx_api_key_company_creator', ['companyId', 'createdByUserId'])
export class ApiKey extends BaseEntity {
  @ManyToOne(() => Company, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company?: Relation<Company>;

  @Column({ type: 'uuid' })
  companyId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdByUserId' })
  createdBy?: Relation<User>;

  @Column({ type: 'uuid' })
  createdByUserId!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text' })
  prefix!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  keyHash!: string;

  @Column({ type: 'text', array: true })
  scopes!: ApiScope[];

  /** Written at most every few minutes per key, so authenticating is not a write per request. */
  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
