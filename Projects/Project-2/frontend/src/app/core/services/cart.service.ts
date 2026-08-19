import { Service, afterNextRender, computed, effect, signal } from '@angular/core';
import type { CartItem } from '@/app/core/models/cart.model';

const STORAGE_KEY = 'cart';

/**
 * Plain signal store, not NgRx, per AGENTS.md. Persists to localStorage
 * using a read-after-render / guarded-write pattern: SSR can't know a
 * client's stored cart, so the initial read only happens client-side,
 * and every write is guarded so it's a no-op server-side.
 */
@Service()
export class CartService {
  private readonly _items = signal<CartItem[]>([]);
  readonly items = this._items.asReadonly();

  readonly itemCount = computed(() => this._items().reduce((sum, item) => sum + item.quantity, 0));
  readonly subtotal = computed(() =>
    this._items().reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  constructor() {
    afterNextRender(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        this._items.set(JSON.parse(stored));
      } catch {
        // Corrupt/stale stored value — ignore, start from an empty cart.
      }
    });

    effect(() => {
      const items = this._items();
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    });
  }

  add(item: CartItem): void {
    this._items.update((items) => {
      const existing = items.find(
        (i) => i.productId === item.productId && i.variantId === item.variantId,
      );
      if (!existing) return [...items, item];
      return items.map((i) => (i === existing ? { ...i, quantity: i.quantity + item.quantity } : i));
    });
  }

  updateQuantity(productId: string, quantity: number, variantId?: string): void {
    if (quantity <= 0) {
      this.remove(productId, variantId);
      return;
    }
    this._items.update((items) =>
      items.map((i) => (i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i)),
    );
  }

  remove(productId: string, variantId?: string): void {
    this._items.update((items) =>
      items.filter((i) => !(i.productId === productId && i.variantId === variantId)),
    );
  }

  clear(): void {
    this._items.set([]);
  }
}
