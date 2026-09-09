import { Service, computed, inject, signal } from '@angular/core';
import { type Observable, finalize, tap } from 'rxjs';

import type { CartSummaryDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

/**
 * The cart, owned server-side.
 *
 * Every mutation returns the full CartSummary, so this service never derives
 * cart state locally — it stores whatever the server last said. That matters
 * because a guest cart lives behind a signed httpOnly cookie the client
 * cannot read: the server, not this class, decides which cart a request
 * belongs to.
 *
 * Note the summary carries a subtotal and nothing else. There is no
 * discount, tax, shipping or total until GET /checkout/quote, so the cart UI
 * must not imply one.
 */
@Service()
export class CartService {
  private readonly api = inject(ApiClient);

  private readonly summary = signal<CartSummaryDto | null>(null);
  // Starts true — app.ts's bootstrap load() is the only thing that ever
  // clears it (on success OR failure, via finalize below), so a real
  // cart mid-fetch can't be told apart from isEmpty()'s default "no items
  // yet" until that first response actually lands.
  private readonly _loading = signal(true);

  readonly cart = this.summary.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly items = computed(() => this.summary()?.items ?? []);
  readonly itemCount = computed(() => this.summary()?.itemCount ?? 0);
  readonly subtotalMinor = computed(() => this.summary()?.subtotalMinor ?? 0);
  readonly couponCode = computed(() => this.summary()?.couponCode);
  readonly isEmpty = computed(() => this.items().length === 0);

  load(): Observable<CartSummaryDto> {
    return this.api.get<CartSummaryDto>('/cart').pipe(
      this.store(),
      finalize(() => this._loading.set(false)),
    );
  }

  addItem(productId: string, variantSku: string, quantity = 1): Observable<CartSummaryDto> {
    return this.api
      .post<CartSummaryDto>('/cart/items', { productId, variantSku, quantity })
      .pipe(this.store());
  }

  updateQuantity(itemId: string, quantity: number): Observable<CartSummaryDto> {
    return this.api.patch<CartSummaryDto>(`/cart/items/${itemId}`, { quantity }).pipe(this.store());
  }

  removeItem(itemId: string): Observable<CartSummaryDto> {
    return this.api.delete<CartSummaryDto>(`/cart/items/${itemId}`).pipe(this.store());
  }

  applyCoupon(code: string): Observable<CartSummaryDto> {
    return this.api.post<CartSummaryDto>('/cart/coupon', { code }).pipe(this.store());
  }

  removeCoupon(): Observable<CartSummaryDto> {
    return this.api.delete<CartSummaryDto>('/cart/coupon').pipe(this.store());
  }

  /**
   * Folds the guest cart into the user's own. Must be called immediately
   * after login or register — the server clears the guest cookie as part of
   * this, so it is the only moment the two carts can be reconciled.
   */
  mergeGuestCart(): Observable<CartSummaryDto> {
    return this.api.post<CartSummaryDto>('/cart/merge', {}).pipe(this.store());
  }

  /**
   * Replaces local state after an out-of-band change — the AI assistant
   * writes to the same cart server-side, so an approved tool call needs this.
   */
  refresh(): Observable<CartSummaryDto> {
    return this.load();
  }

  private store() {
    return tap<CartSummaryDto>((summary) => this.summary.set(summary));
  }
}
