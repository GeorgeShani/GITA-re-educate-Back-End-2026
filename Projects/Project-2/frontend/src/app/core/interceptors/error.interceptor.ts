import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '@/app/core/services/toast.service';

/**
 * Surfaces failed requests as toasts, then re-throws so callers can still
 * handle them.
 *
 * 401 is deliberately silent: the auth interceptor refreshes and retries,
 * and a toast for a request that then succeeds is just noise.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status !== 401) {
        toastService.show(messageFor(error, req.url), 'error');
      }
      return throwError(() => error);
    }),
  );
};

function messageFor(error: HttpErrorResponse, url: string): string {
  if (error.status === 0) {
    return 'Network error — check your connection.';
  }

  if (error.status === 429) {
    // AUTH_THROTTLE is 5 per 15 minutes, far tighter than WRITE_THROTTLE's
    // 5/minute — "give it a moment" undersells a 15-minute window, and on
    // a login form specifically a bare 429 reads exactly like a wrong
    // password if it isn't named as a rate limit.
    if (url.includes('/auth/')) {
      return 'Too many attempts — please wait about 15 minutes and try again.';
    }
    // Most other mutations are throttled at 5/minute, which is easy to hit
    // by nudging a quantity stepper. Saying so beats a generic failure.
    return 'You are doing that a bit too quickly — give it a moment.';
  }

  const body: unknown = error.error;

  // A backend running NestJS's ValidationPipe/HttpExceptionFilter always
  // sends `{ message, statusCode, ... }` JSON (ApiErrorBody, from
  // core/api/dto.ts) — but that filter never gets a chance to run when
  // the backend process itself is unreachable. In dev, the CLI's own
  // proxy (proxy.conf.json → http-proxy-middleware) answers ECONNREFUSED
  // with an empty text/plain 500 of its own, carrying no `.message` at
  // all — so reading past this point would just be guessing. Show
  // exactly what the HTTP layer actually reported instead of a made-up
  // phrase, so a dead backend is instantly recognisable in the toast.
  if (typeof body === 'string' && body.trim().length > 0) {
    return body;
  }

  const message = hasMessage(body) ? body.message : undefined;

  // ValidationPipe returns an array of messages; show the first rather than
  // a stringified array.
  if (Array.isArray(message)) {
    return typeof message[0] === 'string'
      ? message[0]
      : 'Please check the form and try again.';
  }

  if (typeof message === 'string' && message.length > 0) {
    return message;
  }

  return `${error.status} ${error.statusText || 'Error'} on ${url}`;
}

function hasMessage(value: unknown): value is { message: unknown } {
  return typeof value === 'object' && value !== null && 'message' in value;
}
