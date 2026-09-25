import type { ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/** `'http'`, `'graphql'` or `'ws'` — whatever is executing this handler. */
export function isGraphql(context: ExecutionContext): boolean {
  return context.getType<string>() === 'graphql';
}

/**
 * The underlying HTTP request, whichever surface reached the handler.
 *
 * Over REST it is `switchToHttp().getRequest()`. Over GraphQL that call would return the
 * resolver's ROOT OBJECT, not the request, so a guard using it would see "no user" and — being
 * a guard that skips when there is nothing to check — quietly let the request through. Every
 * guard reads the request through here, so one query cannot slip past by changing transport.
 * The GraphQL context is built in `GraphqlApiModule` as `{ req, res }`.
 */
export function requestOf<TRequest extends object>(context: ExecutionContext): TRequest {
  if (isGraphql(context)) return GqlExecutionContext.create(context).getContext<{ req: TRequest }>().req;
  return context.switchToHttp().getRequest<TRequest>();
}

/** The response, same rule as `requestOf`. */
export function responseOf<TResponse extends object>(context: ExecutionContext): TResponse {
  if (isGraphql(context)) return GqlExecutionContext.create(context).getContext<{ res: TResponse }>().res;
  return context.switchToHttp().getResponse<TResponse>();
}
