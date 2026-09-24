import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
import { User } from './user.entity.js';

/** `oauth_exchange` is the 60-second code a Google callback hands the browser in place of a session. */
export const AUTH_TOKEN_TYPES = ['activation', 'invite', 'password_reset', 'oauth_exchange'] as const;
export type AuthTokenType = (typeof AUTH_TOKEN_TYPES)[number];

/**
 * Hashed, single-use. Only the hash is ever stored — a database leak must not
 * hand out working activation, invite, or password-reset links.
 */
@Entity({ name: 'auth_token' })
export class AuthToken extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: AUTH_TOKEN_TYPES, enumName: 'auth_token_type' })
  type!: AuthTokenType;

  @Index({ unique: true })
  @Column({ type: 'text' })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;
}
