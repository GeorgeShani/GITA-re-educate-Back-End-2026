import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface IssuedToken {
  /** Sent to the user once (in an email link, or a login response). Never stored. */
  plaintext: string;
  /** What the database keeps. */
  hash: string;
}

/**
 * Opaque, single-purpose tokens — activation, invite, password reset, refresh.
 * 32 random bytes, stored only as a SHA-256 hash.
 *
 * A fast hash is correct here, unlike for passwords: these are 256 bits of
 * entropy, so there is nothing to brute-force and no reason to pay scrypt's cost
 * on every refresh. What the hash buys is that a database leak does not hand
 * out working links.
 */
@Injectable()
export class TokenFactory {
  issue(): IssuedToken {
    const plaintext = randomBytes(32).toString('base64url');
    return { plaintext, hash: this.hash(plaintext) };
  }

  hash(plaintext: string): string {
    return createHash('sha256').update(plaintext).digest('hex');
  }
}
