import { Service, afterNextRender, effect, signal } from '@angular/core';

const STORAGE_KEY = 'search-history';
const MAX_ITEMS = 6;

/**
 * The shopper's last few search terms, kept in localStorage so the search
 * box can offer them again on a fresh visit. Same SSR-safe read/write
 * shape as recently-viewed.service.ts: seed empty, hydrate once
 * `afterNextRender` confirms a browser, persist through an effect.
 */
@Service()
export class SearchHistoryService {
  private readonly _terms = signal<string[]>([]);
  readonly terms = this._terms.asReadonly();

  constructor() {
    afterNextRender(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        const parsed: unknown = JSON.parse(stored);
        if (isStringArray(parsed)) this._terms.set(parsed.slice(0, MAX_ITEMS));
      } catch {
        // Corrupt/stale value — start from an empty history.
      }
    });

    effect(() => {
      const terms = this._terms();
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(terms));
    });
  }

  /** Records a term, most-recent-first, de-duplicated case-insensitively. */
  record(term: string): void {
    const trimmed = term.trim();
    if (!trimmed) return;
    this._terms.update((current) => {
      const lower = trimmed.toLowerCase();
      return [trimmed, ...current.filter((t) => t.toLowerCase() !== lower)].slice(0, MAX_ITEMS);
    });
  }

  remove(term: string): void {
    this._terms.update((current) => current.filter((t) => t !== term));
  }

  clear(): void {
    this._terms.set([]);
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
