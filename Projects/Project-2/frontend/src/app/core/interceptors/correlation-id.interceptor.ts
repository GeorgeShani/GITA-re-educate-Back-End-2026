import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * Matches the backend's outbox correlation_id (SCOPE.md B2) so a request
 * can be traced end-to-end once a real API exists. crypto.randomUUID() is
 * available in both the browser and Angular's Node-based SSR runtime, so
 * this needs no platform guard.
 */
export const correlationIdInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req.clone({ setHeaders: { 'X-Correlation-Id': crypto.randomUUID() } }));
};
