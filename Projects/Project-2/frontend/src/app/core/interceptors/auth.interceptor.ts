import type { HttpInterceptorFn } from '@angular/common/http';

/**
 * No-op placeholder: AuthService only tracks the current user right now,
 * not a credential/token (that lands with Phase F7's real login flow), so
 * there's nothing to attach yet. This just reserves the pipeline slot —
 * app.config.ts already wires it in ahead of that request/response
 * shape being decided, so nothing else changes when it is.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => next(req);
