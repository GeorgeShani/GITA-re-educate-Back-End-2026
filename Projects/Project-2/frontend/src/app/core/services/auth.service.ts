import { Service, computed, signal } from '@angular/core';

import type { User } from '@/app/core/models/user.model';

/** Deliberately minimal — real login/token persistence is Phase F7. This just establishes the state shape other things (the auth interceptor, header account icon) can depend on. */
@Service()
export class AuthService {
  private readonly _currentUser = signal<User | null>(null);
  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  setCurrentUser(user: User | null): void {
    this._currentUser.set(user);
  }
}
