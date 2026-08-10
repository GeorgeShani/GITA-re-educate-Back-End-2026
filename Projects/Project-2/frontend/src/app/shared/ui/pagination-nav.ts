import { Component, computed, input, output } from '@angular/core';

import { IconGlyph } from './icon-glyph';

const ELLIPSIS = -1;

/** 1 … 4 5 [6] 7 8 … 20 — always shows first, last, current, and current's immediate neighbors. */
function buildPageList(current: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages = new Set<number>([1, total, current]);
  if (current - 1 >= 1) pages.add(current - 1);
  if (current + 1 <= total) pages.add(current + 1);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i];
    if (page === undefined) continue;
    const previous = sorted[i - 1];
    if (i > 0 && previous !== undefined && page - previous > 1) result.push(ELLIPSIS);
    result.push(page);
  }
  return result;
}

@Component({
  selector: 'pagination-nav',
  imports: [IconGlyph],
  host: {
    role: 'navigation',
    'aria-label': 'Pagination',
  },
  template: `
    <button
      type="button"
      class="pagination-nav__step"
      aria-label="Previous page"
      [disabled]="page() <= 1"
      (click)="go(page() - 1)"
    >
      <icon-glyph name="chevron-right" [size]="16" class="pagination-nav__prev-icon" />
    </button>
    @for (p of pages(); track $index) {
      @if (p === ellipsis) {
        <span class="pagination-nav__ellipsis" aria-hidden="true">…</span>
      } @else {
        <button
          type="button"
          class="pagination-nav__page"
          [class.is-active]="p === page()"
          [attr.aria-current]="p === page() ? 'page' : null"
          (click)="go(p)"
        >
          {{ p }}
        </button>
      }
    }
    <button
      type="button"
      class="pagination-nav__step"
      aria-label="Next page"
      [disabled]="page() >= total()"
      (click)="go(page() + 1)"
    >
      <icon-glyph name="chevron-right" [size]="16" />
    </button>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .pagination-nav__step,
    .pagination-nav__page {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 32px;
      height: 32px;
      padding: 0 var(--space-2);
      border-radius: var(--radius-sm);
      background: none;
      border: none;
      @include type.caption-1;
      color: var(--color-neutral-06);
      transition: background-color var(--duration-fast) var(--ease-out);
    }

    .pagination-nav__step:hover:not(:disabled),
    .pagination-nav__page:hover {
      background: var(--color-neutral-02);
    }

    .pagination-nav__step:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .pagination-nav__page.is-active {
      @include type.caption-1-semi;
      background: var(--color-neutral-07);
      color: var(--color-white);
    }

    .pagination-nav__prev-icon {
      transform: rotate(180deg);
    }

    .pagination-nav__ellipsis {
      color: var(--color-neutral-04);
    }
  `,
})
export class PaginationNav {
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly ellipsis = ELLIPSIS;
  protected readonly pages = computed(() => buildPageList(this.page(), this.total()));

  protected go(target: number): void {
    if (target < 1 || target > this.total() || target === this.page()) return;
    this.pageChange.emit(target);
  }
}
