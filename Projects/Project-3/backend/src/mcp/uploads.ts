import {
  BadRequestException,
  ConflictException,
  PayloadTooLargeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { IdempotencyStore } from '#/core/idempotency/idempotency-store.js';
import { hashRequest } from '#/core/idempotency/request-hash.js';
import type { IncomingSpreadsheet } from '#/files/incoming-spreadsheet.js';

/** What an agent may send in one call. The JSON body limit (12 MB, base64 inflates by a third) is set above this. */
export const MAX_MCP_UPLOAD_BYTES = 8 * 1024 * 1024;

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * An upload an agent describes in words: CSV as `text`, or any spreadsheet as `base64`. It becomes the same
 * `IncomingSpreadsheet` a multipart file does, and the bytes are sniffed exactly as they are for REST: a `.exe`
 * sent as base64 is refused by `FilesService`, whatever name it was given.
 */
export function incomingFrom(input: { name: string; text?: string; base64?: string }): IncomingSpreadsheet {
  const { name, text, base64 } = input;
  if ((text === undefined) === (base64 === undefined)) {
    throw new BadRequestException('Send exactly one of `text` (a CSV) or `base64` (any spreadsheet).');
  }

  let buffer: Buffer;
  if (text !== undefined) {
    buffer = Buffer.from(text, 'utf8');
  } else {
    const compact = (base64 ?? '').replace(/\s+/g, '');
    if (!BASE64.test(compact) || compact.length % 4 === 1) {
      throw new BadRequestException('`base64` is not valid base64.');
    }
    buffer = Buffer.from(compact, 'base64');
  }

  if (buffer.length === 0) throw new BadRequestException('The file is empty.');
  if (buffer.length > MAX_MCP_UPLOAD_BYTES) {
    throw new PayloadTooLargeException(
      `Over ${MAX_MCP_UPLOAD_BYTES / (1024 * 1024)} MB through MCP. Upload larger files with POST /files.`,
    );
  }
  return { buffer, name, size: buffer.length };
}

interface IdempotentRun<T> {
  store: IdempotencyStore;
  companyId: string;
  /** Absent: the call just runs (the key is optional, as on REST). */
  key: string | undefined;
  /** What this request is, so the same key on a different tool is refused rather than replayed. */
  route: string;
  userId: string | undefined;
  /** The request's own content: a retry must match it exactly. */
  body: object;
  file: Buffer;
  run: () => Promise<T>;
}

/**
 * `Idempotency-Key` for the MCP upload tools, over the same store and the same rules as the REST interceptor: a retry
 * with the same key and the same content replays the first answer and uploads nothing; the same key for something
 * else is a 422; one still running is a 409; a call that FAILED is forgotten so it can be retried.
 */
export async function idempotently<T>(options: IdempotentRun<T>): Promise<T | { replayed: true; result: unknown }> {
  const { store, companyId, key, route, userId, body, file, run } = options;
  if (key === undefined) return run();

  const claim = await store.claim(companyId, key, route, hashRequest({ method: 'MCP', path: route, userId, body, file }));
  switch (claim.kind) {
    case 'mismatch':
      throw new UnprocessableEntityException(
        'This idempotencyKey was already used for a different request. Send a new key for a new request.',
      );
    case 'in_progress':
      throw new ConflictException('A request with this idempotencyKey is still being processed. Retry shortly.');
    case 'replay':
      return { replayed: true, result: claim.body };
    case 'proceed':
      try {
        const result = await run();
        await store.complete(claim.recordId, 201, result, {});
        return result;
      } catch (error) {
        await store.release(claim.recordId);
        throw error;
      }
  }
}
