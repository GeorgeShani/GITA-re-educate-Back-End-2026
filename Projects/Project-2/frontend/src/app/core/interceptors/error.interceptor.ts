import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '@/app/core/services/toast.service';

/** Surfaces any failed request via the existing toast system, then re-throws so callers can still handle it themselves. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toastService = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        const message =
          error.status === 0
            ? 'Network error — check your connection.'
            : ((error.error as { message?: string } | null)?.message ?? 'Something went wrong. Please try again.');
        toastService.show(message, 'error');
      }
      return throwError(() => error);
    }),
  );
};
