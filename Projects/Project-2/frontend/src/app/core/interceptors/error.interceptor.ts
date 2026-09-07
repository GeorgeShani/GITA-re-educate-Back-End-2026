import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import type { ApiErrorBody } from '@/app/core/api/dto';
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
        toastService.show(messageFor(error), 'error');
      }
      return throwError(() => error);
    }),
  );
};

function messageFor(error: HttpErrorResponse): string {
  if (error.status === 0) {
    return 'Network error — check your connection.';
  }

  // Most mutations are throttled at 5/minute, which is easy to hit by
  // nudging a quantity stepper. Saying so beats a generic failure.
  if (error.status === 429) {
    return 'You are doing that a bit too quickly — give it a moment.';
  }

  const body = error.error as ApiErrorBody | null;
  const message = body?.message;

  // ValidationPipe returns an array of messages; show the first rather than
  // a stringified array.
  if (Array.isArray(message)) {
    return message[0] ?? 'Please check the form and try again.';
  }

  return message ?? 'Something went wrong. Please try again.';
}
