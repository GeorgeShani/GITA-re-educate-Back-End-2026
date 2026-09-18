import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation, Unique } from 'typeorm';
import { BaseEntity } from '../base.entity.js';
import { User } from './user.entity.js';

export const AUTH_PROVIDERS = ['password', 'google'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/**
 * Credentials, separated from identity — see SCOPE.md's "Identity model:
 * email is not the key". `providerUserId` is the provider's stable subject
 * (`sub`), never the email; `email`/`emailVerified` are whatever that
 * provider reports and may differ from `User.email` forever without anything
 * breaking. Sign-in looks up by `(provider, providerUserId)`, never by email.
 */
@Entity({ name: 'auth_identity' })
@Unique(['provider', 'providerUserId'])
export class AuthIdentity extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: Relation<User>;

  /** Not covered by the (provider, providerUserId) unique index above. */
  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: AUTH_PROVIDERS, enumName: 'auth_provider' })
  provider!: AuthProvider;

  @Column({ type: 'text' })
  providerUserId!: string;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  /** Set only when `provider = 'password'`. */
  @Column({ type: 'text', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;
}
