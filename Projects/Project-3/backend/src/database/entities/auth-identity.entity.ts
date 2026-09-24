import { Column, Entity, Index, JoinColumn, ManyToOne, type Relation, Unique } from 'typeorm';
import { BaseEntity } from '#/database/base.entity.js';
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
/**
 * `User.email` is only unique per company, so on its own it cannot identify
 * who is logging in. A password login email must therefore be globally
 * unambiguous: this partial unique index on `lower(email)` (password identities
 * only — a Google identity's email is whatever Google reports) is what
 * guarantees one login email = one account. Consequence, documented in the
 * README: the same person needs a different login email per company.
 *
 * The expression is not expressible in a decorator, so the index is created by
 * hand in the migration; `synchronize: false` tells TypeORM's schema diff to
 * leave it alone instead of generating a DROP for an index it can't see here.
 */
@Entity({ name: 'auth_identity' })
@Unique(['provider', 'providerUserId'])
// One identity per provider per user: "link Google" twice cannot leave a user
// answering to two different Google accounts.
@Unique('uq_auth_identity_user_provider', ['userId', 'provider'])
@Index('uq_auth_identity_password_email', { synchronize: false })
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
