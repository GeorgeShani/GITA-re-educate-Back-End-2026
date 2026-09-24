import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Clock } from '#/core/clock/clock.js';
import { type PresignOptions, type StorageDriver } from './storage-driver.js';

export interface LocalDriverOptions {
  /** Directory the objects live under. */
  root: string;
  /** Origin the signed download URL points at — this API. */
  baseUrl: string;
  /** Signs download URLs; derived from a server secret, never used elsewhere. */
  secret: Buffer | string;
  clock: Clock;
}

export interface LocalDownload {
  key: string;
  downloadName: string;
}

/**
 * Disk storage for offline development and the test harness. There is no S3 to
 * presign against, so the "presigned" URL points back at this API's
 * `GET /storage/local`, authenticated by an HMAC over the key, expiry and name —
 * the same trust model as an S3 presigned URL: possession of an unexpired,
 * untampered link is the credential.
 */
export class LocalStorageDriver implements StorageDriver {
  private readonly root: string;

  constructor(private readonly options: LocalDriverOptions) {
    this.root = resolve(options.root);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async presignedGetUrl(key: string, options: PresignOptions): Promise<string> {
    const exp = Math.floor(this.options.clock.now().getTime() / 1000) + options.expiresInSeconds;
    const url = new URL('/storage/local', this.options.baseUrl);
    url.searchParams.set('key', key);
    url.searchParams.set('exp', String(exp));
    url.searchParams.set('name', options.downloadName);
    url.searchParams.set('sig', this.sign(key, exp, options.downloadName));
    return url.toString();
  }

  /** What a request to the signed URL is allowed to read, or `null` if it is expired or tampered with. */
  verify(params: { key: string; exp: string; name: string; sig: string }): LocalDownload | null {
    const exp = Number(params.exp);
    if (!Number.isInteger(exp)) return null;
    if (exp * 1000 <= this.options.clock.now().getTime()) return null;

    const expected = Buffer.from(this.sign(params.key, exp, params.name));
    const given = Buffer.from(params.sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return { key: params.key, downloadName: params.name };
  }

  private sign(key: string, exp: number, name: string): string {
    return createHmac('sha256', this.options.secret)
      .update(`${key}\n${exp}\n${name}`)
      .digest('base64url');
  }

  /** Keys are server-generated, but a key that resolves outside `root` is refused outright. */
  private pathFor(key: string): string {
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error(`Refusing storage key outside the root: ${key}`);
    return path;
  }
}
