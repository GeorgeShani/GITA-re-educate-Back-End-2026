import { createHash, randomBytes } from 'node:crypto';

// Used for email-verification and password-reset tokens: generate a raw
// token, send the raw value out (email link), store only the hash. A DB
// leak alone is never enough to forge a live link.
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
