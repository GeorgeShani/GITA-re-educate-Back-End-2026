import { type ExecutionContext, BadRequestException, createParamDecorator } from '@nestjs/common';
import { isUUID } from 'class-validator';

/**
 * Pulls `Idempotency-Key` and validates it's a UUID. This is the concrete
 * mechanism behind the "idempotency keys" reliability primitive named in
 * SCOPE.md: `POST /files` and `PATCH /subscriptions/me` (later milestones)
 * will store `(idempotencyKey, responseSnapshot)` and replay the snapshot on
 * a retry instead of re-running the side effect.
 *
 * Returns `undefined` when the header is absent — the key is optional at
 * this layer; a route that requires one checks for `undefined` itself,
 * since "idempotency is mandatory here" is a per-route decision this
 * decorator has no business making.
 */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();

    const header = request.headers['idempotency-key'];
    const value = Array.isArray(header) ? header[0] : header;
    if (value === undefined) return undefined;

    if (!isUUID(value)) {
      throw new BadRequestException('Idempotency-Key must be a UUID');
    }
    return value;
  },
);
