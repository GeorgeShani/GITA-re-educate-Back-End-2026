import { Component, computed, effect, inject, input, signal } from '@angular/core';

import { NewsletterSignup } from '@/app/features/home/newsletter-signup';
import { CatalogService, toCardProduct } from '@/app/core/services/catalog.service';
import { SeoService } from '@/app/core/services/seo.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { BreadcrumbTrail, type BreadcrumbItem } from '@/app/shared/ui/breadcrumb-trail';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { ProductCard } from '@/app/shared/ui/product-card';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { TabGroup, type TabItem } from '@/app/shared/ui/tab-group';
import { ProductGallery } from './product-gallery';
import { ProductPurchasePanel } from './product-purchase-panel';
import { ProductReviews } from './product-reviews';

type DetailTab = 'description' | 'reviews';

const TABS: TabItem[] = [
  { id: 'description', label: 'Description' },
  { id: 'reviews', label: 'Reviews' },
];

/**
 * `/product/:slug`. `slug` arrives as a component input via
 * withComponentInputBinding() — same pattern as shop.ts's query-param
 * inputs, just from the path instead.
 */
@Component({
  selector: 'product-detail-page',
  imports: [
    PageContainer,
    PageSection,
    BreadcrumbTrail,
    ProductGallery,
    ProductPurchasePanel,
    TabGroup,
    ProductReviews,
    ProductCard,
    SkeletonBlock,
    NewsletterSignup,
    RevealDirective,
  ],
  template: `
    <page-section spacing="sm" reveal>
      <page-container>
        <breadcrumb-trail [items]="breadcrumbs()" />
      </page-container>
    </page-section>

    @if (product.isLoading()) {
      <page-section spacing="md">
        <page-container>
          <div class="layout">
            <skeleton-block height="728px" radius="var(--radius-lg)" />
            <div class="info-skeleton">
              <skeleton-block height="24px" radius="var(--radius-sm)" />
              <skeleton-block height="40px" radius="var(--radius-sm)" />
              <skeleton-block height="96px" radius="var(--radius-sm)" />
              <skeleton-block height="48px" radius="var(--radius-sm)" />
            </div>
          </div>
        </page-container>
      </page-section>
    } @else if (product.error()) {
      <page-section spacing="lg">
        <page-container>
          <p class="message">We couldn't find that product.</p>
        </page-container>
      </page-section>
    } @else if (product.value(); as p) {
      <page-section spacing="md" reveal>
        <page-container>
          <div class="layout">
            <product-gallery [images]="p.images" />
            <product-purchase-panel [product]="p" />
          </div>
        </page-container>
      </page-section>

      <page-section spacing="lg" reveal>
        <page-container>
          <tab-group
            [tabs]="tabs"
            [selected]="activeTab()"
            ariaLabel="Product details"
            (selectedChange)="selectTab($event)"
          />

          <div class="panel" role="tabpanel">
            @switch (activeTab()) {
              @case ('description') {
                <p class="description">{{ p.description }}</p>
                @if (p.careInstructions; as care) {
                  <h3>Care instructions</h3>
                  <p class="description">{{ care }}</p>
                }
              }
              @case ('reviews') {
                <product-reviews [product]="p" />
              }
            }
          </div>
        </page-container>
      </page-section>

      @if (relatedCards().length) {
        <page-section spacing="lg" reveal>
          <page-container>
            <h2 class="section-head">You might also like</h2>
            <div class="grid">
              @for (item of relatedCards(); track item.slug; let i = $index) {
                <product-card reveal [revealIndex]="i" [revealStagger]="80" [product]="item" />
              }
            </div>
          </page-container>
        </page-section>
      }

      <newsletter-signup reveal />
    }
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-8);

      @include bp.tablet-up {
        grid-template-columns: 1fr 1fr;
        gap: var(--space-10);
      }
    }

    .info-skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .message {
      @include type.body-1;
      color: var(--color-neutral-04);
    }

    .panel {
      padding-top: var(--space-6);
      max-width: 48rem;
    }

    .description {
      @include type.body-2;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-05);
      white-space: pre-line;
    }

    .panel h3 {
      @include type.body-2-semi;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .section-head {
      @include type.headline-6;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-07);
    }

    .grid {
      display: grid;
      gap: var(--space-6);
      grid-template-columns: repeat(2, minmax(0, 1fr));

      @include bp.tablet-up {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
  `,
})
export default class ProductDetail {
  private readonly catalog = inject(CatalogService);
  private readonly seo = inject(SeoService);

  readonly slug = input<string>();

  protected readonly tabs = TABS;
  protected readonly activeTab = signal<DetailTab>('description');

  protected selectTab(id: string): void {
    if (id === 'description' || id === 'reviews') this.activeTab.set(id);
  }

  protected readonly product = this.catalog.productResource(() => this.slug());
  protected readonly related = this.catalog.relatedResource(() => this.slug());

  protected readonly relatedCards = computed(() => (this.related.value() ?? []).map(toCardProduct));

  protected readonly breadcrumbs = computed<BreadcrumbItem[]>(() => {
    const name = this.product.value()?.name;
    return [
      { label: 'Home', link: '/' },
      { label: 'Shop', link: '/shop' },
      { label: name ?? '...' },
    ];
  });

  constructor() {
    // ProductDto already carries seoTitle/seoDescription/seoOgImageUrl
    // (backend/src/catalog/schemas/product.schema.ts) — nothing on the
    // frontend ever read them before this; every product page rendered
    // with the same static <title>3legant</title> from index.html and no
    // description or Open Graph tags at all.
    effect(() => {
      const p = this.product.value();
      if (!p) return;

      const image = p.images[0];
      this.seo.set({
        title: p.seoTitle ?? p.name,
        description: p.seoDescription ?? p.description,
        image: p.seoOgImageUrl ?? (image ? this.seo.absoluteUrl(image.url) : undefined),
        type: 'website',
      });

      this.seo.setJsonLd({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.name,
        description: p.description,
        image: p.images.map((img) => this.seo.absoluteUrl(img.url)),
        sku: p.variants[0]?.sku,
        brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
        aggregateRating:
          p.ratingCount > 0
            ? {
                '@type': 'AggregateRating',
                ratingValue: p.ratingAverage,
                reviewCount: p.ratingCount,
              }
            : undefined,
        offers: {
          '@type': 'Offer',
          url: this.seo.absoluteUrl(`/product/${p.slug}`),
          priceCurrency: 'USD',
          price: (p.basePriceMinor / 100).toFixed(2),
          availability: p.variants.some((v) => v.isActive)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      });
    });
  }
}
