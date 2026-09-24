import type { CookieOptions } from 'express';
import { OAUTH_STATE_TTL_SECONDS } from '../auth.constants.js';

/**
 * Binds a Google flow to the browser that started it. The nonce is in the signed
 * `state` too; the callback needs the two to agree, which is what stops a
 * victim's browser being fed an attacker's callback (login CSRF).
 *
 * `Path=/`, not `/auth/...`: behind Caddy the browser sees `/api/auth/...` while
 * the API sees the stripped path, so a narrower path would never be sent back.
 * `SameSite=Lax` still sends it on the top-level navigation Google redirects to.
 */
export const OAUTH_NONCE_COOKIE = 'gl_oauth_nonce';

export function nonceCookieOptions(isProduction: boolean): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/',
    maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
  };
}

/** One cookie out of a raw `Cookie` header; there is no cookie-parser in this app. */
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}
