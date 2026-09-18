import { BadRequestException } from '@nestjs/common';

export interface Cursor {
  createdAt: Date;
  id: string;
}

/**
 * Opaque, base64url-encoded `(createdAt, id)` pair — never `createdAt`
 * alone. Two rows landing in the same millisecond would otherwise break the
 * page boundary; the `id` tie-break is the easy detail to forget and the
 * reason keyset pagination has a worse reputation than it deserves. Proven
 * against real data with a deliberate collision in
 * `src/database/keyset-pagination.integration.spec.ts`.
 */
export function encodeCursor(cursor: Cursor): string {
  const payload = `${cursor.createdAt.toISOString()}|${cursor.id}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

export function decodeCursor(value: string): Cursor {
  let payload: string;
  try {
    payload = Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    throw new BadRequestException('Invalid cursor');
  }

  const [isoDate, id] = payload.split('|');
  if (!isoDate || !id) {
    throw new BadRequestException('Invalid cursor');
  }

  const createdAt = new Date(isoDate);
  if (Number.isNaN(createdAt.getTime())) {
    throw new BadRequestException('Invalid cursor');
  }

  return { createdAt, id };
}
