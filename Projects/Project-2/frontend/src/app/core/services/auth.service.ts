import { Service, computed, inject, signal } from '@angular/core';
import { Observable, finalize, of, shareReplay, switchMap, tap } from 'rxjs';

import type { AuthTokensDto, UserDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';
import { TokenStore } from '@/app/core/services/token-store';

export interface RegisterInput {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
}

@Service()
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly tokens = inject(TokenStore);

  private readonly user = signal<UserDto | null>(null);
  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.tokens.isAuthenticated());

  /**
   * The in-flight refresh, shared by every caller.
   *
   * This is the single most important detail in the auth layer. Refresh
   * tokens rotate, and the API treats a second presentation of an
   * already-rotated token as theft: it revokes EVERY session for that user.
   * So if two requests 401 at once and each fires its own refresh, the
   * second one logs the user out everywhere. Funnelling them through one
   * shared observable makes concurrent 401s await a single request.
   */
  private refreshInFlight: Observable<AuthTokensDto> | null = null;

  register(input: RegisterInput): Observable<AuthTokensDto> {
    return this.api
      .post<AuthTokensDto>('/auth/register', input)
      .pipe(switchMap((tokens) => this.adopt(tokens)));
  }

  login(email: string, password: string): Observable<AuthTokensDto> {
    return this.api
      .post<AuthTokensDto>('/auth/login', { email, password })
      .pipe(switchMap((tokens) => this.adopt(tokens)));
  }

  refresh(): Observable<AuthTokensDto> {
    this.refreshInFlight ??= this.api
      .post<AuthTokensDto>('/auth/refresh', {
        refreshToken: this.tokens.refreshToken(),
      })
      .pipe(
        tap((tokens) => this.tokens.set(tokens)),
        // Cleared on success AND failure, so a later 401 can start a new
        // attempt rather than replaying a dead one forever.
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshInFlight;
  }

  logout(): Observable<void> {
    const refreshToken = this.tokens.refreshToken();
    this.clearSession();
    // Best-effort server-side revocation; the client is already logged out
    // either way, and the endpoint is silent for unknown tokens.
    return refreshToken ? this.api.post<void>('/auth/logout', { refreshToken }) : of(undefined);
  }

  /** Drops local session state without calling the server. */
  clearSession(): void {
    this.tokens.clear();
    this.user.set(null);
  }

  loadCurrentUser(): Observable<UserDto> {
    return this.api.get<UserDto>('/auth/me').pipe(tap((user) => this.user.set(user)));
  }

  verifyEmail(token: string): Observable<void> {
    return this.api.post<void>('/auth/verify-email', { token });
  }

  forgotPassword(email: string): Observable<void> {
    return this.api.post<void>('/auth/forgot-password', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.api.post<void>('/auth/reset-password', { token, newPassword });
  }

  private adopt(tokens: AuthTokensDto): Observable<AuthTokensDto> {
    this.tokens.set(tokens);
    // Fetch the profile for `roles` — the JWT only carries a single role.
    return this.loadCurrentUser().pipe(switchMap(() => of(tokens)));
  }
}
