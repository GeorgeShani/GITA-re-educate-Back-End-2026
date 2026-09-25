import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES_KEY = 'requiredScopes';

/** Every scope a key can hold. Add here, not by inventing a parallel type elsewhere. */
export const API_SCOPES = ['files:read', 'files:write', 'billing:read'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

/**
 * The API-key analogue of `@Roles`, enforced by `ScopesGuard`. Composes with `@Roles`
 * so a route can demand a role AND a scope: a key's effective permission is
 * (creator's live role ∩ key's granted scopes), never wider than either.
 *
 * A route WITHOUT this decorator is unreachable by any API key. That is the point: the
 * default is deny, so identity, credentials, employees, plan changes and key management
 * are closed to keys by construction, and a leaked key cannot mint more persistence.
 */
export const RequireScopes = (...scopes: ApiScope[]) =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);
