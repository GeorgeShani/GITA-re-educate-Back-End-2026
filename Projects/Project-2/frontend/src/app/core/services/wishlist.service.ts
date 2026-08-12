import { Service, afterNextRender, effect, signal } from '@angular/core';

const STORAGE_KEY = 'wishlist';

@Service()
export class WishlistService {
  private readonly _slugs = signal<ReadonlySet<string>>(new Set());
  readonly slugs = this._slugs.asReadonly();

  constructor() {
    afterNextRender(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        this._slugs.set(new Set(JSON.parse(stored) as string[]));
      } catch {
        // Corrupt/stale stored value — ignore, start from an empty wishlist.
      }
    });

    effect(() => {
      const slugs = this._slugs();
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...slugs]));
    });
  }

  has(slug: string): boolean {
    return this._slugs().has(slug);
  }

  toggle(slug: string): void {
    this._slugs.update((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }
}
