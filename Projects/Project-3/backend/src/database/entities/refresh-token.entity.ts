import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { User } from './user.entity.js';

/**
 * Rotated on every use. `replacedById` chains a token to whatever replaced
 * it — a plain pointer, not a formal foreign key, since enforcing
 * referential integrity on a rotation chain buys nothing here and
 * complicates deletion. Presenting an already-rotated token (one whose
 * `revokedAt` is set for a reason other than its own successful rotation) is
 * how the auth module (Milestone 3) detects reuse and revokes the whole
 * family.
 */
@Entity({ name: 'refresh_token' })
export class RefreshToken extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  /**
   * Every token descended from one login shares a family. Presenting an
   * already-rotated token revokes the whole family with a single UPDATE — the
   * replay defence — and logout / password change do the same.
   */
  @Index()
  @Column({ type: 'uuid' })
  familyId!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  replacedById!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'text', nullable: true })
  ip!: string | null;
}
