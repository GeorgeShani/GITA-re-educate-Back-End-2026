import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';

import type { ProductQuery } from '@/app/core/api/dto';
import { CatalogService, toCardProduct } from '@/app/core/services/catalog.service';
import { SeoService } from '@/app/core/services/seo.service';
import { toUnionValue } from '@/app/core/util/string-union';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { PaginationNav } from '@/app/shared/ui/pagination-nav';
import { ProductCard } from '@/app/shared/ui/product-card';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

const TAKE = 12;

const SORT_OPTIONS: SelectOption[] = [
  { value: 'newest:desc', label: 'Newest' },
  { value: 'price:asc', label: 'Price, low to high' },
  { value: 'price:desc', label: 'Price, high to low' },
  { value: 'rating:desc', label: 'Top rated' },
  { value: 'popularity:desc', label: 'Most reviewed' },
];

// Mirrors ProductQuery['sort']/['order'] (core/api/dto.ts) — a query param
// is a raw string a URL can put anything in, unlike the sort dropdown
// itself, which only ever emits one of these.
const SORT_VALUES: NonNullable<ProductQuery['sort']>[] = ['price', 'newest', 'rating', 'popularity'];
const ORDER_VALUES: NonNullable<ProductQuery['order']>[] = ['asc', 'desc'];

/**
 * Product listing.
 *
 * All filter state lives in the URL rather than component signals, so a
 * filtered view is shareable, survives a reload, and the back button steps
 * through filter changes the way a shopper expects. Route params arrive as
 * inputs via withComponentInputBinding(), and the httpResource refetches
 * whenever the derived query changes.
 */
@Component({
  selector: 'shop-page',
  imports: [
    PageContainer,
    PageSection,
    ProductCard,
    PaginationNav,
    SelectField,
    SkeletonBlock,
    RevealDirective,
    EmptyState,
    ActionButton,
  ],
  template: `
    <page-section spacing="md">
      <page-container>
        <header class="head" reveal>
          <div>
            <h1>{{ heading() }}</h1>
            @if (!products.isLoading()) {
              <p class="count">{{ total() }} {{ total() === 1 ? 'product' : 'products' }}</p>
            }
          </div>

          <select-field
            class="sort"
            label="Sort by"
            [options]="sortOptions"
            [value]="sortValue()"
            (valueChange)="onSortChange($event)"
          />
        </header>

        <div class="layout" reveal>
          <aside class="filters" aria-label="Filters">
            <section>
              <h2>Category</h2>
              <ul role="list">
                <li>
                  <button
                    type="button"
                    [class.active]="!category()"
                    (click)="setParam('category', null)"
                  >
                    All categories
                  </button>
                </li>
                @for (node of categories.value() ?? []; track node.id) {
                  <li>
                    <button
                      type="button"
                      [class.active]="category() === node.slug"
                      (click)="setParam('category', node.slug)"
                    >
                      {{ node.name }}
                    </button>
                  </li>
                }
              </ul>
            </section>

            @if ((facets.value()?.brands ?? []).length) {
              <section>
                <h2>Brand</h2>
                <ul role="list">
                  <li>
                    <button
                      type="button"
                      [class.active]="!brand()"
                      (click)="setParam('brand', null)"
                    >
                      All brands
                    </button>
                  </li>
                  @for (row of facets.value()?.brands ?? []; track row.brand) {
                    <li>
                      <button
                        type="button"
                        [class.active]="brand() === row.brand"
                        (click)="setParam('brand', row.brand)"
                      >
                        {{ row.brand }} <span class="tally">{{ row.count }}</span>
                      </button>
                    </li>
                  }
                </ul>
              </section>
            }
          </aside>

          <div class="results">
            @if (products.isLoading()) {
              <div class="grid">
                @for (n of skeletons; track n) {
                  <skeleton-block height="420px" radius="var(--radius-lg)" />
                }
              </div>
            } @else if (unknownCategory()) {
              <empty-state message="We couldn't find that category." icon="search">
                <action-button action variant="secondary" size="s" (click)="clearFilters()">
                  Browse all products
                </action-button>
              </empty-state>
            } @else if (products.error()) {
              <empty-state message="Could not load products right now." icon="triangle-alert">
                <action-button action variant="secondary" size="s" (click)="products.reload()">
                  Try again
                </action-button>
              </empty-state>
            } @else if (cards().length === 0) {
              <empty-state message="No products match those filters." icon="search">
                @if (hasActiveFilters()) {
                  <action-button action variant="secondary" size="s" (click)="clearFilters()">
                    Clear filters
                  </action-button>
                }
              </empty-state>
            } @else {
              <div class="grid">
                @for (product of cards(); track product.slug) {
                  <product-card [product]="product" />
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
          </div>
        </div>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-8);

      h1 {
        @include type.headline-5;
        margin: 0;
        color: var(--color-neutral-07);
      }
    }

    .count {
      @include type.caption-1;
      margin: var(--space-2) 0 0;
      color: var(--color-neutral-04);
    }

    .sort {
      min-width: 220px;
    }

    .layout {
      display: grid;
      gap: var(--space-8);

      @include bp.tablet-up {
        grid-template-columns: 220px minmax(0, 1fr);
      }
    }

    .filters {
      display: grid;
      gap: var(--space-8);
      align-content: start;

      h2 {
        @include type.caption-1-semi;
        margin: 0 0 var(--space-3);
        color: var(--color-neutral-07);
      }

      ul {
        display: grid;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
      }

      button {
        @include type.caption-1;
        display: flex;
        justify-content: space-between;
        gap: var(--space-2);
        width: 100%;
        padding: var(--space-2) var(--space-3);
        border: 0;
        border-radius: var(--radius-md);
        background: none;
        color: var(--color-neutral-05);
        text-align: left;
        cursor: pointer;

        &:hover {
          background: var(--color-neutral-02);
        }

        &.active {
          background: var(--color-neutral-07);
          color: var(--color-neutral-01);
        }
      }
    }

    .tally {
      color: currentColor;
      opacity: 0.6;
    }

    .grid {
      display: grid;
      gap: var(--space-6);
      grid-template-columns: repeat(2, minmax(0, 1fr));

      @include bp.tablet-up {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    pagination-nav {
      display: block;
      margin-top: var(--space-10);
    }
  `,
})
export default class Shop {
  private readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  // Bound from the URL by withComponentInputBinding().
  readonly q = input<string>();
  readonly category = input<string>();
  readonly brand = input<string>();
  readonly sort = input<string>();

  protected readonly pageParam = input<string>('1', { alias: 'page' });

  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly skeletons = [0, 1, 2, 3, 4, 5];
  protected readonly String = String;

  protected readonly page = computed(() => {
    const parsed = Number(this.pageParam());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });

  protected readonly sortValue = computed(() => this.sort() ?? 'newest:desc');

  private readonly query = computed<ProductQuery>(() => {
    const [sort, order] = this.sortValue().split(':');
    return {
      q: this.q(),
      category: this.category(),
      brand: this.brand(),
      // A hand-edited ?sort= in the URL can carry anything — fall back to
      // the same default the dropdown itself defaults to rather than
      // silently sending the backend a value it never actually offered.
      sort: toUnionValue(sort ?? '', SORT_VALUES) ?? 'newest',
      order: toUnionValue(order ?? '', ORDER_VALUES) ?? 'desc',
      page: this.page(),
      take: TAKE,
    };
  });

  protected readonly products = this.catalog.productsResource(() => this.query());
  protected readonly categories = this.catalog.categoryTreeResource();
  protected readonly facets = this.catalog.facetsResource(() => this.category());

  // `.value()` throws while the resource is in an error state, so read it
  // through hasValue() — these are referenced from the template header
  // that renders regardless of the loading/error branch.
  private readonly result = computed(() =>
    this.products.hasValue() ? this.products.value() : undefined,
  );
  protected readonly cards = computed(() =>
    (this.result()?.items ?? []).map(toCardProduct),
  );
  protected readonly total = computed(() => this.result()?.total ?? 0);
  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  // A 404 from the list endpoint while a category filter is set means the
  // slug in the URL doesn't resolve — a hand-typed or stale link, not an
  // outage. Show a "no such category" state, not "try again".
  protected readonly unknownCategory = computed(() => {
    const error = this.products.error();
    return (
      !!this.category() && error instanceof HttpErrorResponse && error.status === 404
    );
  });

  protected readonly heading = computed(() => {
    const term = this.q();
    if (term) return `Results for "${term}"`;
    const name = (this.categories.value() ?? []).find((c) => c.slug === this.category())?.name;
    return name ?? 'All products';
  });

  constructor() {
    effect(() => {
      this.seo.set({
        title: this.heading(),
        description:
          'Shop golf clubs, apparel, and accessories — filter by category and brand to find your next piece of kit.',
      });
    });
  }

  protected readonly hasActiveFilters = computed(
    () => !!(this.q() || this.category() || this.brand()),
  );

  protected clearFilters(): void {
    void this.router.navigate([], { queryParams: {} });
  }

  protected onSortChange(value: string): void {
    this.setParam('sort', value === 'newest:desc' ? null : value);
  }

  /**
   * Writes one filter into the URL. Changing a filter always returns to page
   * one — staying on page 4 of a result set that just shrank to two pages
   * shows an empty grid for no visible reason.
   */
  protected setParam(key: string, value: string | null): void {
    void this.router.navigate([], {
      queryParams: { [key]: value, ...(key === 'page' ? {} : { page: null }) },
      queryParamsHandling: 'merge',
    });
  }
}
