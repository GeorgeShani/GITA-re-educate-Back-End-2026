import { Service, computed, signal } from '@angular/core';

import type { AccessTokenClaims, AuthTokensDto, RoleDto } from '@/app/core/api/dto';

const ACCESS_KEY = 'auth.accessToken';
const REFRESH_KEY = 'auth.refreshToken';

/**
 * Holds the token pair. The API returns both in the response body — there
 * are no auth cookies — so the client is responsible for storing them and
 * attaching the access token itself.
 *
 * Reads and writes are wrapped because this runs under SSR too, where
 * `localStorage` does not exist, and in browsers that block site storage
 * entirely (private mode, cookie-blocking settings) where merely touching
 * it throws.
 */
@Service()
export class TokenStore {
  private readonly access = signal<string | null>(read(ACCESS_KEY));
  private readonly refresh = signal<string | null>(read(REFRESH_KEY));

  readonly accessToken = this.access.asReadonly();
  readonly refreshToken = this.refresh.asReadonly();

  /** Claims of the current access token, or null if absent/unparseable. */
  readonly claims = computed<AccessTokenClaims | null>(() => decodeJwt(this.access()));

  readonly isAuthenticated = computed(() => this.access() !== null);

  /** The single active role the JWT carries — NOT the full roles array. */
  readonly role = computed<RoleDto | null>(() => this.claims()?.role ?? null);

  set(tokens: AuthTokensDto): void {
    this.access.set(tokens.accessToken);
    this.refresh.set(tokens.refreshToken);
    write(ACCESS_KEY, tokens.accessToken);
    write(REFRESH_KEY, tokens.refreshToken);
  }

  clear(): void {
    this.access.set(null);
    this.refresh.set(null);
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
  }
}

function read(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) {
      globalThis.localStorage?.removeItem(key);
    } else {
      globalThis.localStorage?.setItem(key, value);
    }
  } catch {
    // Storage unavailable — the in-memory signal still works for this tab.
  }
}

/**
 * Reads the payload without verifying the signature. That is fine here: the
 * claims are only used to decide what to render. Every actual authorisation
 * decision is made by the server, which does verify.
 */
function decodeJwt(token: string | null): AccessTokenClaims | null {
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(json);
    return isAccessTokenClaims(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isAccessTokenClaims(value: unknown): value is AccessTokenClaims {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sub' in value &&
    typeof value.sub === 'string' &&
    'email' in value &&
    typeof value.email === 'string' &&
    'role' in value &&
    typeof value.role === 'string' &&
    'exp' in value &&
    typeof value.exp === 'number' &&
    'iat' in value &&
    typeof value.iat === 'number'
  );
}
