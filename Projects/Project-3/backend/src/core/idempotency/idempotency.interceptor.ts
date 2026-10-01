import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request, Response } from 'express';
import { type Observable, catchError, from, of, switchMap, throwError } from 'rxjs';
import { RequestContextService } from '#/core/context/request-context.service.js';
import { IdempotencyStore } from './idempotency-store.js';
import { hashRequest } from './request-hash.js';

/** Headers a handler may set that a replay must reproduce. */
const REPLAYED_HEADER_PREFIX = 'x-gridline-';

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
 * and can be part of "the same request". The claim bookkeeping lives in `IdempotencyStore`.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly store: IdempotencyStore,
    private readonly context: RequestContextService,
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

    const claim = await this.store.claim(companyId, key, route, requestHash);
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
            from(
              this.store
                .complete(claim.recordId, response.statusCode, body, replayedHeaders(response))
                .then(() => body),
            ),
          ),
          // A failed request is not remembered: the client fixes it and retries with the same key.
          catchError((error: unknown) =>
            from(this.store.release(claim.recordId)).pipe(switchMap(() => throwError(() => error))),
          ),
        );
    }
  }
}

function replayedHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(response.getHeaders())) {
    if (name.startsWith(REPLAYED_HEADER_PREFIX) && typeof value === 'string') headers[name] = value;
  }
  return headers;
}
