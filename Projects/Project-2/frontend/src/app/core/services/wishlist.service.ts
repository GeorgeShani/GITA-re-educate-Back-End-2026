import { Service, computed, inject, signal } from '@angular/core';
import { type Observable, tap } from 'rxjs';

import type { WishlistEntryDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

/**
 * Owned server-side, same pattern as CartService — the wishlist is
 * per-account (GET /wishlist requires auth), not a guest-accessible
 * concept, so there's no local/guest state to merge on login the way
 * the cart has.
 */
@Service()
export class WishlistService {
  private readonly api = inject(ApiClient);

  private readonly entries = signal<WishlistEntryDto[] | null>(null);

  readonly items = computed(() => this.entries() ?? []);
  readonly productIds = computed(() => new Set(this.items().map((e) => e.productId)));

  load(): Observable<WishlistEntryDto[]> {
    return this.api.get<WishlistEntryDto[]>('/wishlist').pipe(this.store());
  }

  has(productId: string): boolean {
    return this.productIds().has(productId);
  }

  add(productId: string): Observable<WishlistEntryDto[]> {
    return this.api.post<WishlistEntryDto[]>(`/wishlist/${productId}`, {}).pipe(this.store());
  }

  remove(productId: string): Observable<WishlistEntryDto[]> {
    return this.api.delete<WishlistEntryDto[]>(`/wishlist/${productId}`).pipe(this.store());
  }

  toggle(productId: string): Observable<WishlistEntryDto[]> {
    return this.has(productId) ? this.remove(productId) : this.add(productId);
  }

  private store() {
    return tap<WishlistEntryDto[]>((entries) => this.entries.set(entries));
  }
}
