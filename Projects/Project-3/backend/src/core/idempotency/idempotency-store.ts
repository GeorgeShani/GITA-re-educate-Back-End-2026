import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { IdempotencyRecord } from './idempotency-record.entity.js';

/** A key is remembered for a day; after that the same key is a new request. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
/** An `in_progress` claim older than this belongs to a request that never finished (a crash). */
export const IDEMPOTENCY_STALE_CLAIM_MS = 10 * 60_000;

const storedBody = z.json();
const storedHeaders = z.record(z.string(), z.string());

export type Claim =
  | { kind: 'proceed'; recordId: string }
  | { kind: 'replay'; statusCode: number; body: unknown; headers: Record<string, string> }
  | { kind: 'mismatch' }
  | { kind: 'in_progress' };

/**
 * The storage half of idempotency, shared by every doorway that offers it: the REST interceptor and the MCP upload tool.
 * It knows nothing about HTTP: a caller says what the request IS (`route`, `requestHash`) and gets back what to do.
 */
@Injectable()
export class IdempotencyStore {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Insert-first: the row is the claim. `ON CONFLICT DO NOTHING` returning nothing
   * means someone already holds this key, and then their row decides what happens.
   */
  async claim(companyId: string, key: string, route: string, requestHash: string): Promise<Claim> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const inserted = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(IdempotencyRecord)
        .values({ companyId, key, route, requestHash, status: 'in_progress' })
        .orIgnore()
        .returning(['id'])
        .execute();
      const raw: unknown = inserted.raw[0];
      if (typeof raw === 'object' && raw !== null && 'id' in raw && typeof raw.id === 'string') {
        return { kind: 'proceed', recordId: raw.id };
      }

      const existing = await this.dataSource
        .getRepository(IdempotencyRecord)
        .findOne({ where: { companyId, key } });
      if (!existing) continue; // released between our insert and our read: claim it now

      const age = this.clock.now().getTime() - existing.createdAt.getTime();
      const abandoned = existing.status === 'in_progress' && age > IDEMPOTENCY_STALE_CLAIM_MS;
      if (age > IDEMPOTENCY_TTL_MS || abandoned) {
        await this.dataSource.getRepository(IdempotencyRecord).delete({ id: existing.id });
        continue;
      }

      if (existing.route !== route || existing.requestHash !== requestHash) {
        return { kind: 'mismatch' };
      }
      if (existing.status === 'in_progress') return { kind: 'in_progress' };

      const body = storedBody.safeParse(existing.responseBody);
      const headers = storedHeaders.safeParse(existing.responseHeaders ?? {});
      return {
        kind: 'replay',
        statusCode: existing.statusCode ?? 200,
        body: body.success ? body.data : null,
        headers: headers.success ? headers.data : {},
      };
    }
    throw new ConflictException('Could not settle this Idempotency-Key. Retry shortly.');
  }

  async complete(
    recordId: string,
    statusCode: number,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<void> {
    await this.dataSource.getRepository(IdempotencyRecord).update(
      { id: recordId },
      {
        status: 'completed',
        statusCode,
        // Snapshot as the client saw it: dates as ISO strings, class instances as plain data.
        responseBody: body === undefined ? null : JSON.parse(JSON.stringify(body)),
        responseHeaders: headers,
      },
    );
  }

  /** A failed request is not remembered: the client fixes it and retries with the same key. */
  async release(recordId: string): Promise<void> {
    await this.dataSource.getRepository(IdempotencyRecord).delete({ id: recordId });
  }
}
