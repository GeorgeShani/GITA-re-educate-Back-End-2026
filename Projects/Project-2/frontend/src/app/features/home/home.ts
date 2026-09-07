import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CatalogService, toCardProduct } from '@/app/core/services/catalog.service';
import { ActionButton } from '@/app/shared/ui/action-button';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { ProductCard } from '@/app/shared/ui/product-card';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

/**
 * Landing page. F2 scope is deliberately narrow: a hero, the featured rail,
 * and the category grid — enough to prove the data layer end to end. The
 * remaining sections (sale banner, collection grid, journal, newsletter,
 * Instagram) land in F3.
 */
@Component({
  selector: 'home-page',
  imports: [RouterLink, PageContainer, PageSection, ProductCard, ActionButton, SkeletonBlock],
  template: `
    <section class="hero">
      <page-container>
        <div class="hero-content">
          <h1>More than just a game.<br />It&rsquo;s a lifestyle.</h1>
          <p>
            Whether you are starting out, have played your whole life, or you are a Tour pro &mdash;
            your swing is like a fingerprint.
          </p>
          <action-button routerLink="/shop" size="m">Shop the range</action-button>
        </div>
      </page-container>
    </section>

    <page-section spacing="lg">
      <page-container>
        <header class="section-head">
          <h2>Featured</h2>
          <a routerLink="/shop">View all</a>
        </header>

        @if (featured.isLoading()) {
          <div class="grid">
            @for (placeholder of skeletons; track placeholder) {
              <skeleton-block height="420px" radius="var(--radius-lg)" />
            }
          </div>
        } @else if (featured.error()) {
          <p class="empty">Could not load products right now.</p>
        } @else {
          <div class="grid">
            @for (product of featuredCards(); track product.slug) {
              <product-card [product]="product" />
            }
          </div>
        }
      </page-container>
    </page-section>

    <page-section spacing="lg">
      <page-container>
        <header class="section-head">
          <h2>Shop by category</h2>
        </header>
        <div class="categories">
          @for (category of categories.value() ?? []; track category.id) {
            <a class="category" [routerLink]="['/shop']" [queryParams]="{ category: category.id }">
              <span>{{ category.name }}</span>
            </a>
          }
        </div>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .hero {
      padding-block: var(--space-10);
      background: var(--color-neutral-02);

      @include bp.tablet-up {
        padding-block: calc(var(--space-10) * 2);
      }
    }

    .hero-content {
      max-width: 32ch;

      h1 {
        @include type.headline-4;
        margin: 0;
        color: var(--color-neutral-07);

        @include bp.tablet-up {
          @include type.headline-2;
        }
      }

      p {
        @include type.body-2;
        margin: var(--space-5) 0 var(--space-8);
      }
    }

    .section-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-8);

      h2 {
        @include type.headline-5;
        margin: 0;
        color: var(--color-neutral-07);
      }

      a {
        @include type.caption-1-semi;
        color: var(--color-neutral-05);
        text-decoration: underline;
      }
    }

    .grid {
      display: grid;
      gap: var(--space-6);
      grid-template-columns: repeat(2, minmax(0, 1fr));

      @include bp.tablet-up {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }

    .categories {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(2, minmax(0, 1fr));

      @include bp.tablet-up {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .category {
      @include type.body-2-semi;
      display: grid;
      place-items: center;
      min-height: 120px;
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-neutral-02);
      color: var(--color-neutral-07);
      text-align: center;
      transition: background var(--duration-fast) var(--ease-out);

      &:hover {
        background: var(--color-neutral-03);
      }
    }

    .empty {
      @include type.body-2;
      color: var(--color-neutral-04);
    }
  `,
})
export default class Home {
  private readonly catalog = inject(CatalogService);

  protected readonly skeletons = [0, 1, 2, 3];

  protected readonly featured = this.catalog.productsResource(() => ({
    isFeatured: true,
    take: 4,
  }));

  protected readonly categories = this.catalog.categoryTreeResource();

  protected readonly featuredCards = computed(() =>
    (this.featured.value()?.items ?? []).map(toCardProduct),
  );
}
