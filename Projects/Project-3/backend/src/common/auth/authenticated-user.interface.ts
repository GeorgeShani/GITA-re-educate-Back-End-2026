import type { UserRole } from '#/database/entities/user.entity.js';
import type { ApiScope } from './require-scopes.decorator.js';

/**
 * What `request.user` holds once `AuthGuard` has authenticated a request.
 * Built from the user's database row on every request, never from the token.
 */
export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  /** The person's LIVE role — for an API key, the creator's role right now, never a snapshot. */
  role: UserRole;
  /** How this request proved who it is. A key is never as powerful as a session (see `ScopesGuard`). */
  authMethod: 'jwt' | 'api_key';
  /** The company is the seeded read-only demo: `DemoReadOnlyGuard` refuses every write. */
  isDemo: boolean;
  /** Only for `api_key`: the scopes the key holds, already narrowed by the creator's role. */
  scopes?: ApiScope[];
  /** Only for `api_key`: which key made the request, for the audit trail. */
  apiKeyId?: string;
}
