import { HttpContext, HttpContextToken, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '@/app/core/services/toast.service';
import { apiErrorMessage } from '@/app/core/util/api-error-message';

/**
 * Set on a request whose caller shows its own error inline (the auth forms,
 * via form-error.ts). A toast on top would say the same thing twice.
 */
export const INLINE_ERRORS = new HttpContextToken<boolean>(() => false);

export function inlineErrors(): HttpContext {
  return new HttpContext().set(INLINE_ERRORS, true);
}

/**
 * Surfaces failed requests as toasts, then re-throws so callers can still
 * handle them.
 *
 * 401 is deliberately silent: the auth interceptor refreshes and retries,
 * and a toast for a request that then succeeds is just noise. That is also
 * why a wrong password used to show nothing at all — sign-in's 401 is now
 * rendered by the form itself.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status !== 401 &&
        !req.context.get(INLINE_ERRORS)
      ) {
        toastService.show(apiErrorMessage(error), 'error');
      }
      return throwError(() => error);
    }),
  );
};
