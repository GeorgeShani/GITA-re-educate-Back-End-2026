import { HttpErrorResponse, type HttpInterceptorFn, type HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '@/app/core/services/auth.service';
import { TokenStore } from '@/app/core/services/token-store';

/**
 * Endpoints that must never trigger a refresh attempt. A 401 from
 * /auth/refresh means the refresh token itself is dead, so retrying would
 * loop; a 401 from /auth/login just means bad credentials.
 */
const NO_RETRY = ['/auth/refresh', '/auth/login', '/auth/register'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokens = inject(TokenStore);
  const auth = inject(AuthService);

  // The guest cart rides a signed httpOnly cookie the client cannot read.
  // Same-origin (via the dev proxy) sends it anyway, but setting this keeps
  // a cross-origin deployment working without hunting for why carts empty.
  const authed = attach(req.clone({ withCredentials: true }), tokens.accessToken());

  return next(authed).pipe(
    catchError((error: unknown) => {
      const isUnauthorized = error instanceof HttpErrorResponse && error.status === 401;
      const retryable =
        isUnauthorized &&
        !NO_RETRY.some((path) => req.url.includes(path)) &&
        tokens.refreshToken() !== null;

      if (!retryable) return throwError(() => error);

      // Concurrent 401s all await the SAME refresh — see AuthService.refresh
      // for why racing them would revoke every session the user has.
      return auth.refresh().pipe(
        switchMap((refreshed) => next(attach(authed, refreshed.accessToken))),
        catchError((refreshError: unknown) => {
          auth.clearSession();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

function attach<T>(req: HttpRequest<T>, accessToken: string | null): HttpRequest<T> {
  return accessToken ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }) : req;
}
