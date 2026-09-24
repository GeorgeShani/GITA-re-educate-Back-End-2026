import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request, Response } from 'express';
import { type Observable, catchError, from, of, switchMap, throwError } from 'rxjs';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { CLOCK, type Clock } from '#/core/clock/clock.js';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { IdempotencyRecord } from './idempotency-record.entity.js';
import { hashRequest } from './request-hash.js';

/** A key is remembered for a day; after that the same key is a new request. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60_000;
/** An `in_progress` claim older than this belongs to a request that never finished (a crash). */
export const IDEMPOTENCY_STALE_CLAIM_MS = 10 * 60_000;

/** Headers a handler may set that a replay must reproduce. */
const REPLAYED_HEADER_PREFIX = 'x-gridline-';

const storedBody = z.json();
const storedHeaders = z.record(z.string(), z.string());

type Claim =
  | { kind: 'proceed'; recordId: string }
  | { kind: 'replay'; statusCode: number; body: unknown; headers: Record<string, string> }
  | { kind: 'mismatch' }
  | { kind: 'in_progress' };

/**
 * Makes a retried request safe. With an `Idempotency-Key` header, the FIRST request
 * runs and its response is stored; a retry with the same key and the same request
 * replays that response and runs nothing — so a client that timed out and retried an
 * upload or a plan change cannot double-count quota or double-charge. Without the
 * header the interceptor does nothing (the key is optional).
 *
 * - same key, different request (route, caller, body or file) → **422**
 * - same key while the first is still running → **409**
 * - a request that FAILED is forgotten, so the retry can run again
 *
 * List it AFTER `FileInterceptor` on an upload route, so the file has been parsed
 * and can be part of "the same request".
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly dataSource: DataSource,
    private readonly context: RequestContextService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const header = request.headers['idempotency-key'];
    const key = Array.isArray(header) ? header[0] : header;
    const companyId = this.context.companyId;
    if (key === undefined || !companyId) return next.handle();
    if (!isUUID(key)) throw new BadRequestException('Idempotency-Key must be a UUID');

    const route = `${request.method} ${request.route?.path ?? request.path}`;
    const requestHash = hashRequest({
      method: request.method,
      path: request.path,
      userId: this.context.userId,
      body: request.body,
      file: request.file?.buffer,
    });

    const claim = await this.claim(companyId, key, route, requestHash);
    switch (claim.kind) {
      case 'mismatch':
        throw new UnprocessableEntityException(
          'This Idempotency-Key was already used for a different request. Send a new key for a new request.',
        );
      case 'in_progress':
        throw new ConflictException(
          'A request with this Idempotency-Key is still being processed. Retry shortly.',
        );
      case 'replay':
        response.status(claim.statusCode);
        for (const [name, value] of Object.entries(claim.headers)) response.setHeader(name, value);
        response.setHeader('Idempotent-Replayed', 'true');
        return of(claim.body);
      case 'proceed':
        return next.handle().pipe(
          switchMap((body: unknown) =>
            from(this.complete(claim.recordId, response, body).then(() => body)),
          ),
          // A failed request is not remembered: the client fixes it and retries with the same key.
          catchError((error: unknown) =>
            from(this.release(claim.recordId)).pipe(switchMap(() => throwError(() => error))),
          ),
        );
    }
  }

  /**
   * Insert-first: the row is the claim. `ON CONFLICT DO NOTHING` returning nothing
   * means someone already holds this key, and then their row decides what happens.
   */
  private async claim(
    companyId: string,
    key: string,
    route: string,
    requestHash: string,
  ): Promise<Claim> {
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

  private async complete(recordId: string, response: Response, body: unknown): Promise<void> {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(response.getHeaders())) {
      if (name.startsWith(REPLAYED_HEADER_PREFIX) && typeof value === 'string') headers[name] = value;
    }

    await this.dataSource.getRepository(IdempotencyRecord).update(
      { id: recordId },
      {
        status: 'completed',
        statusCode: response.statusCode,
        // Snapshot as the client saw it: dates as ISO strings, class instances as plain data.
        responseBody: body === undefined ? null : JSON.parse(JSON.stringify(body)),
        responseHeaders: headers,
      },
    );
  }

  private async release(recordId: string): Promise<void> {
    await this.dataSource.getRepository(IdempotencyRecord).delete({ id: recordId });
  }
}
