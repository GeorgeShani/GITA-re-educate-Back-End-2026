import { NgOptimizedImage } from '@angular/common';
import { Component, computed, effect, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { ProductQuery } from '@/app/core/api/dto';
import { CatalogService, toCardProduct } from '@/app/core/services/catalog.service';
import { SearchHistoryService } from '@/app/core/services/search-history.service';
import { SeoService } from '@/app/core/services/seo.service';
import { toUnionValue } from '@/app/core/util/string-union';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { PaginationNav } from '@/app/shared/ui/pagination-nav';
import { ProductCard } from '@/app/shared/ui/product-card';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { SearchBox } from './search-box';

const TAKE = 12;

// `relevance` is the sentinel for "send no sort" — the API ranks a `?q=`
// query by text-match score when `sort` is omitted, which is what a
// search page wants by default. The rest mirror shop.ts's dropdown.
const SORT_OPTIONS: SelectOption[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest:desc', label: 'Newest' },
  { value: 'price:asc', label: 'Price, low to high' },
  { value: 'price:desc', label: 'Price, high to low' },
  { value: 'rating:desc', label: 'Top rated' },
];

const SORT_VALUES: NonNullable<ProductQuery['sort']>[] = ['price', 'newest', 'rating', 'popularity'];
const ORDER_VALUES: NonNullable<ProductQuery['order']>[] = ['asc', 'desc'];

/**
 * `/search` — the storefront's dedicated search experience.
 *
 * Like shop.ts, all state lives in the URL (`?q=`, `?sort=`, `?page=`) so
 * a result view is shareable and survives a reload; route params arrive
 * as inputs via withComponentInputBinding(). With no `?q=` the page shows
 * a browse prompt (recent searches + categories) instead of an empty grid.
 */
@Component({
  selector: 'search-page',
  imports: [
    NgOptimizedImage,
    RouterLink,
    PageContainer,
    PageSection,
    ProductCard,
    PaginationNav,
    SelectField,
    SkeletonBlock,
    EmptyState,
    ActionButton,
    RevealDirective,
    IconGlyph,
    SearchBox,
  ],
  template: `
    <page-section spacing="md">
      <page-container>
        <header class="head" reveal>
          <h1>{{ heading() }}</h1>
          <search-box
            class="box"
            [initialValue]="q() ?? ''"
            (search)="runSearch($event)"
          />
        </header>

        @if (!q()) {
          <div class="browse" reveal>
            @if (history.terms().length) {
              <section class="recent">
                <div class="recent-head">
                  <h2>Recent searches</h2>
                  <button type="button" class="text-action" (click)="history.clear()">Clear all</button>
                </div>
                <ul class="chips" role="list">
                  @for (term of history.terms(); track term) {
                    <li class="chip">
                      <button type="button" class="chip-term" (click)="runSearch(term)">{{ term }}</button>
                      <button
                        type="button"
                        class="chip-remove"
                        [attr.aria-label]="'Remove ' + term"
                        (click)="history.remove(term)"
                      >
                        <icon-glyph name="x" [size]="14" />
                      </button>
                    </li>
                  }
                </ul>
              </section>
            }

            <section class="browse-categories">
              <h2>Browse by category</h2>
              @if (categories.isLoading()) {
                <div class="category-grid">
                  @for (n of skeletons; track n) {
                    <skeleton-block height="200px" radius="var(--radius-lg)" />
                  }
                </div>
              } @else {
                <div class="category-grid">
                  @for (category of categories.value() ?? []; track category.id; let i = $index) {
                    <a
                      class="category"
                      reveal
                      [revealIndex]="i"
                      [revealStagger]="50"
                      [routerLink]="['/shop']"
                      [queryParams]="{ category: category.slug }"
                    >
                      @if (category.imageUrl) {
                        <!-- The first tiles sit above the fold on the empty
                             state — one is the LCP element, so load eagerly. -->
                        <img [ngSrc]="category.imageUrl" alt="" fill [priority]="i < 2" />
                      }
                      <span class="category-label">
                        {{ category.name }}
                        <icon-glyph name="arrow-right" [size]="16" />
                      </span>
                    </a>
                  }
                </div>
              }
            </section>
          </div>
        } @else {
          <div class="results-head" reveal>
            @if (!results.isLoading()) {
              <p class="count">
                {{ total() }} {{ total() === 1 ? 'result' : 'results' }} for
                <span class="term">&ldquo;{{ q() }}&rdquo;</span>
              </p>
            }
            <select-field
              class="sort"
              label="Sort by"
              [options]="sortOptions"
              [value]="sortValue()"
              (valueChange)="onSortChange($event)"
            />
          </div>

          @if (results.isLoading()) {
            <div class="grid">
              @for (n of skeletons; track n) {
                <skeleton-block height="420px" radius="var(--radius-lg)" />
              }
            </div>
          } @else if (results.error()) {
            <empty-state message="Search is unavailable right now." icon="triangle-alert">
              <action-button action variant="secondary" size="s" (click)="results.reload()">
                Try again
              </action-button>
            </empty-state>
          } @else if (cards().length === 0) {
            <empty-state [message]="noResultsMessage()" icon="search">
              <div action class="no-results-help">
                <p>Try a shorter or more general term, or check the spelling.</p>
                <action-button variant="secondary" size="s" routerLink="/shop">
                  Browse all products
                </action-button>
              </div>
            </empty-state>
          } @else {
            <div class="grid">
              @for (product of cards(); track product.slug; let i = $index) {
                <product-card [product]="product" reveal [revealIndex]="i" [revealStagger]="40" />
              }
            </div>

            @if (pageCount() > 1) {
              <pagination-nav
                [page]="page()"
                [total]="pageCount()"
                (pageChange)="setParam('page', $event === 1 ? null : String($event))"
              />
            }
          }
        }
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .head {
      margin-bottom: var(--space-9);

      h1 {
        @include type.headline-5;
        margin: 0 0 var(--space-5);
        color: var(--color-neutral-07);
        // Search terms are user input — a long unbroken one must wrap, not
        // push the page wider than the viewport.
        overflow-wrap: anywhere;
      }
    }

    .box {
      max-width: 640px;
    }

    /* ------------------------------------------------ browse (no query) */

    .browse {
      display: grid;
      gap: var(--space-10);
    }

    h2 {
      @include type.headline-7;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);
    }

    .recent-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
    }

    .text-action {
      @include type.caption-1-semi;
      border: none;
      background: none;
      color: var(--color-neutral-04);
      cursor: pointer;
    }

    .text-action:hover {
      color: var(--color-neutral-07);
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
    }

    .chip {
      display: flex;
      align-items: center;
      border-radius: var(--radius-full);
      background: var(--color-neutral-02);
    }

    .chip-term {
      @include type.caption-1;
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
      border: none;
      background: none;
      color: var(--color-neutral-06);
      cursor: pointer;
    }

    .chip-remove {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      margin-right: var(--space-1);
      border: none;
      border-radius: var(--radius-full);
      background: none;
      color: var(--color-neutral-04);
      cursor: pointer;
    }

    .chip:hover {
      background: var(--color-neutral-03);
    }

    .chip-remove:hover {
      color: var(--color-neutral-07);
    }

    .category-grid {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(2, minmax(0, 1fr));

      @include bp.tablet-up {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      @include bp.wide-up {
        // 10 categories — two full rows of 5.
        grid-template-columns: repeat(5, minmax(0, 1fr));
      }
    }

    .category {
      position: relative;
      display: block;
      aspect-ratio: 4 / 3;
      border-radius: var(--radius-lg);
      overflow: hidden;
      isolation: isolate;
      background: var(--color-neutral-02);

      img {
        object-fit: cover;
        z-index: -2;
        transition: transform var(--duration-slow) var(--ease-out);
      }

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: linear-gradient(
          to top,
          rgb(20 23 24 / 78%) 0%,
          rgb(20 23 24 / 20%) 55%,
          transparent 100%
        );
      }

      &:hover img {
        transform: scale(1.06);
      }
    }

    .category-label {
      @include type.body-2-semi;
      position: absolute;
      inset-inline: var(--space-4);
      bottom: var(--space-4);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      color: var(--color-neutral-01);

      icon-glyph {
        color: var(--color-success);
      }
    }

    /* ------------------------------------------------------ results */

    .results-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-8);
    }

    .count {
      @include type.body-2;
      margin: 0;
      color: var(--color-neutral-04);
      overflow-wrap: anywhere;
    }

    .term {
      color: var(--color-neutral-07);
    }

    .sort {
      min-width: 220px;
    }

    .grid {
      display: grid;
      gap: var(--space-6);
      grid-template-columns: repeat(2, minmax(0, 1fr));

      @include bp.tablet-up {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      @include bp.wide-up {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    .no-results-help {
      display: grid;
      justify-items: center;
      gap: var(--space-4);
      text-align: center;

      p {
        @include type.body-2;
        max-width: 34ch;
        margin: 0;
      }
    }

    pagination-nav {
      display: flex;
      justify-content: center;
      margin-top: var(--space-10);
    }
  `,
})
export default class Search {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  protected readonly history = inject(SearchHistoryService);

  // Bound from the URL by withComponentInputBinding().
  readonly q = input<string>();
  readonly sort = input<string>();
  protected readonly pageParam = input<string>('1', { alias: 'page' });

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly skeletons = [0, 1, 2, 3, 4, 5, 6, 7];
  protected readonly String = String;

  protected readonly page = computed(() => {
    const parsed = Number(this.pageParam());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });

  protected readonly sortValue = computed(() => this.sort() ?? 'relevance');

  private readonly query = computed(() => {
    const raw = this.sortValue();
    const [field, order] = raw === 'relevance' ? [undefined, undefined] : raw.split(':');
    return {
      q: this.q() ?? '',
      sort: field ? toUnionValue(field, SORT_VALUES) : undefined,
      order: order ? toUnionValue(order, ORDER_VALUES) : undefined,
      page: this.page(),
      take: TAKE,
    };
  });

  protected readonly results = this.catalog.searchResource(() => this.query());
  protected readonly categories = this.catalog.categoryTreeResource();

  // `.value()` throws in the resource's error state — read via hasValue().
  private readonly result = computed(() =>
    this.results.hasValue() ? this.results.value() : undefined,
  );
  protected readonly cards = computed(() =>
    (this.result()?.items ?? []).map(toCardProduct),
  );
  protected readonly total = computed(() => this.result()?.total ?? 0);
  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  protected readonly heading = computed(() => {
    const term = this.q();
    return term ? `Results for “${term}”` : 'Search';
  });

  protected readonly noResultsMessage = computed(() => `No products match “${this.q()}”.`);

  constructor() {
    effect(() => {
      const term = this.q();
      this.seo.set({
        title: term ? `Search: ${term}` : 'Search',
        description: 'Search golf gloves, balls, bags, apparel, rangefinders, and training aids at 3legant Golf.',
      });
    });
  }

  protected runSearch(term: string): void {
    const trimmed = term.trim();
    void this.router.navigate(['/search'], {
      queryParams: { q: trimmed || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected onSortChange(value: string): void {
    this.setParam('sort', value === 'relevance' ? null : value);
  }

  /** Writes one param into the URL; any change but paging returns to page one. */
  protected setParam(key: string, value: string | null): void {
    void this.router.navigate([], {
      queryParams: { [key]: value, ...(key === 'page' ? {} : { page: null }) },
      queryParamsHandling: 'merge',
    });
  }
}
