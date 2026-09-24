import { type ScryptOptions, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';

/** `util.promisify(scrypt)` drops the options overload, so this wraps the callback form directly. */
function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

/** Upper bound the DTO layer also enforces — stops a giant "password" being a CPU DoS. */
export const MAX_PASSWORD_LENGTH = 128;

const PARAMS = { N: 16_384, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * scrypt via `node:crypto` — no native dependency. argon2's prebuilt binaries
 * are a musl/Alpine risk in the Docker runtime image; scrypt is memory-hard
 * and ships with Node.
 *
 * The stored format is self-describing — `scrypt$N$r$p$salt$hash` — so the cost
 * parameters can be raised later and old hashes still verify (and can be
 * rehashed on the next successful login).
 */
@Injectable()
export class PasswordHasher {
  /**
   * Verified against when a login names no known account, so "no such user"
   * costs the same as "wrong password" and timing can't enumerate accounts.
   */
  private dummyHash: Promise<string> | undefined;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const derived = await this.derive(password, salt, PARAMS.N, PARAMS.r, PARAMS.p, KEY_LENGTH);

    return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), derived.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, n, r, p, saltB64, hashB64] = parts;
    const N = Number(n);
    const R = Number(r);
    const P = Number(p);
    if (!Number.isInteger(N) || !Number.isInteger(R) || !Number.isInteger(P)) return false;
    // Ceilings well above what we issue: enough headroom to raise the cost
    // later, low enough that a corrupt row can't ask scrypt for gigabytes.
    if (N < 2 || N > 2 ** 17 || R < 1 || R > 16 || P < 1 || P > 4) return false;
    if (saltB64 === undefined || hashB64 === undefined) return false;

    const expected = Buffer.from(hashB64, 'base64');
    if (expected.length === 0) return false;

    try {
      const actual = await this.derive(password, Buffer.from(saltB64, 'base64'), N, R, P, expected.length);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      // Out-of-range cost parameters in a corrupt stored hash: not a match.
      return false;
    }
  }

  /** Burns the same time a real verification would, and always returns false. */
  async verifyDummy(password: string): Promise<false> {
    this.dummyHash ??= this.hash('gridline-dummy-password');
    await this.verify(password, await this.dummyHash);
    return false;
  }

  private async derive(
    password: string,
    salt: Buffer,
    N: number,
    r: number,
    p: number,
    keyLength: number,
  ): Promise<Buffer> {
    // `maxmem` is raised only as far as the chosen cost needs (128 * N * r
    // bytes, plus headroom). `verify` bounds N/r/p first, so a corrupt stored
    // hash cannot make this allocate an arbitrary amount.
    return scryptAsync(password, salt, keyLength, { N, r, p, maxmem: 256 * N * r });
  }
}
