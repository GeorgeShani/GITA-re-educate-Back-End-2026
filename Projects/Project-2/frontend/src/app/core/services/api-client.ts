import { HttpClient, type HttpContext } from '@angular/common/http';
import { InjectionToken, Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { environment } from '@/environments/environment';

/**
 * Relative in dev (proxy.conf.json forwards /api to localhost:4000,
 * keeping requests same-origin) but absolute in production — the
 * frontend (Vercel) and API (Fly.io) are separate domains there, so
 * there's no dev proxy to make a relative path resolve. See
 * environment.production.ts and cart.controller.ts's
 * maybeSetGuestCookie for the sameSite:'none' this pairs with.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

type QueryParams = Record<string, string | number | boolean>;

/**
 * Thin, typed wrapper around HttpClient. Transfer-state caching (so an
 * SSR-fetched response isn't refetched on hydration) comes free from
 * provideClientHydration(withHttpTransferCacheOptions(...)) in
 * app.config.ts as long as requests go through HttpClient — which every
 * method here does.
 */
@Service()
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(this.url(path), { params });
  }

  post<T>(path: string, body: unknown, options?: { context?: HttpContext }): Observable<T> {
    return this.http.post<T>(this.url(path), body, options);
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.url(path), body);
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(this.url(path));
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
