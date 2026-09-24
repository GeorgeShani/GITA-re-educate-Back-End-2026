export interface PresignOptions {
  expiresInSeconds: number;
  /** What the browser saves the download as. */
  downloadName: string;
}

/**
 * Where uploaded bytes live. `s3` is the default and the graded path; `local`
 * (disk) is an explicit offline-development convenience, and what the test
 * harness uses. Keys are always server-generated — no user input ever reaches
 * one — so a driver never needs to defend against a hostile key, but the local
 * driver checks anyway.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  /** Idempotent: removing an object that is already gone is not an error. */
  delete(key: string): Promise<void>;
  presignedGetUrl(key: string, options: PresignOptions): Promise<string>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

/** `Content-Disposition` value that survives non-ASCII names (RFC 6266 / 5987). */
export function attachmentDisposition(downloadName: string): string {
  // Strip anything that could break out of the header; the real name travels in `filename*`.
  const safe = downloadName.replace(/[\r\n\0]/g, ' ').slice(0, 255);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
