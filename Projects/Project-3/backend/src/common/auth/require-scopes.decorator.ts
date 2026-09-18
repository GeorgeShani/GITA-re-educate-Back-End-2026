import { SetMetadata } from '@nestjs/common';

export const REQUIRED_SCOPES_KEY = 'requiredScopes';

/**
 * The API-key analogue of `@Roles`, for when `ApiKeyGuard` lands (Milestone
 * 10, alongside `api-keys/`). Composes with `@Roles` so a route can demand a
 * role AND a scope: a key's effective permission is
 * (creator's live role ∩ key's granted scopes), never wider than either.
 *
 * This list is intentionally small and will grow with the modules that
 * define what a key can be scoped to (`files/`, `billing/`, …) — add here,
 * not by inventing a parallel type elsewhere.
 */
export type ApiScope = 'files:read' | 'files:write' | 'billing:read';

export const RequireScopes = (...scopes: ApiScope[]) =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);
