import { HttpClient } from '@angular/common/http';
import { InjectionToken, Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

/** No backend exists yet — relative default so this resolves once one's deployed behind the same origin/a proxy, without every call site needing to know. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => '/api',
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

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.url(path), body);
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
