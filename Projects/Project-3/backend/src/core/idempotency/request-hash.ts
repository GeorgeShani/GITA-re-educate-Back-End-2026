import { createHash } from 'node:crypto';

/** JSON with object keys sorted, so the same content hashes the same whatever order it arrived in. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export interface HashableRequest {
  method: string;
  path: string;
  userId: string | undefined;
  body: unknown;
  /** The bytes of an uploaded file, when there is one. */
  file?: Uint8Array | undefined;
}

/**
 * What "the same request" means for an idempotency key: same route, same caller,
 * same body, and — for an upload — the same file bytes. A retry differs in none of
 * these; a different request that reuses a key differs in at least one.
 */
export function hashRequest(request: HashableRequest): string {
  const hash = createHash('sha256');
  hash.update(
    canonicalJson({
      method: request.method,
      path: request.path,
      userId: request.userId ?? null,
      body: request.body ?? null,
    }),
  );
  if (request.file) {
    hash.update('\0file\0');
    hash.update(request.file);
  }
  return hash.digest('hex');
}
