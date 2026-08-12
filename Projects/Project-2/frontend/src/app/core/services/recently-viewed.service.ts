import { Service, afterNextRender, effect, signal } from '@angular/core';

const STORAGE_KEY = 'recently-viewed';
const MAX_ITEMS = 8;

/** No PDP exists yet to call record() from (Phase F5) — the store is built ahead of its consumer, same as the other Phase F3 stores. */
@Service()
export class RecentlyViewedService {
  private readonly _slugs = signal<string[]>([]);
  readonly slugs = this._slugs.asReadonly();

  constructor() {
    afterNextRender(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        this._slugs.set(JSON.parse(stored) as string[]);
      } catch {
        // Corrupt/stale stored value — ignore, start from an empty list.
      }
    });

    effect(() => {
      const slugs = this._slugs();
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
    });
  }

  record(slug: string): void {
    this._slugs.update((current) => [slug, ...current.filter((s) => s !== slug)].slice(0, MAX_ITEMS));
  }
}
