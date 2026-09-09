import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CatalogService, toCardProduct } from '@/app/core/services/catalog.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { ProductCard } from '@/app/shared/ui/product-card';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { CollectionGrid } from './collection-grid';
import { InstagramStrip } from './instagram-strip';
import { LatestArticles } from './latest-articles';
import { NewsletterSignup } from './newsletter-signup';
import { SaleBanner } from './sale-banner';

const ASSURANCES = [
  { icon: 'truck', label: 'Free delivery over $75' },
  { icon: 'banknote', label: '30-day returns, no questions' },
  { icon: 'lock', label: 'Secure checkout' },
] as const;

/**
 * Landing page.
 *
 * The hero is the one authored moment on this page: a full-bleed course
 * photograph carrying the headline, rather than type alone on a grey field.
 * Everything below it stays quiet so that peak reads — the assurance strip
 * is a thin band rather than cards, and the section heads are plain.
 *
 * Category tiles use the imageUrl the categories endpoint already returns.
 * Rendering them as flat colour blocks threw away real photography the API
 * was serving all along.
 */
@Component({
  selector: 'home-page',
  imports: [
    RouterLink,
    NgOptimizedImage,
    PageContainer,
    PageSection,
    ProductCard,
    ActionButton,
    SkeletonBlock,
    IconGlyph,
    RevealDirective,
    SaleBanner,
    CollectionGrid,
    LatestArticles,
    NewsletterSignup,
    InstagramStrip,
  ],
  template: `
    <section class="hero">
      <img
        ngSrc="/images/site/hero-fairway.jpg"
        alt=""
        fill
        priority
        class="hero-image hero-image-settle"
      />
      <div class="hero-scrim"></div>
      <page-container>
        <div class="hero-content">
          <h1 reveal [revealIndex]="0" [revealDelay]="100" [revealStagger]="130">
            More than<br />just a game.<br />It&rsquo;s a lifestyle.
          </h1>
          <p reveal [revealIndex]="1" [revealDelay]="100" [revealStagger]="130">
            Whether you&rsquo;re just starting out, have played your whole
            life, or you&rsquo;re a tour pro — your swing is like a
            fingerprint.
          </p>
          <action-button
            reveal
            [revealIndex]="2"
            [revealDelay]="100"
            [revealStagger]="130"
            routerLink="/shop"
            size="m"
          >
            Shop the range
          </action-button>
        </div>
      </page-container>
    </section>

    <div class="assurances" reveal>
      <page-container>
        <ul role="list">
          @for (item of assurances; track item.label; let i = $index) {
            <li reveal [revealIndex]="i" [revealStagger]="80">
              <icon-glyph [name]="item.icon" [size]="18" />
              <span>{{ item.label }}</span>
            </li>
          }
        </ul>
      </page-container>
    </div>

    <page-section spacing="lg">
      <page-container>
        <header class="section-head" reveal>
          <h2>Featured</h2>
          <a routerLink="/shop">View all<icon-glyph name="arrow-right" [size]="16" /></a>
        </header>

        @if (featured.isLoading()) {
          <div class="grid">
            @for (placeholder of skeletons; track placeholder) {
              <skeleton-block height="420px" radius="var(--radius-lg)" />
            }
          </div>
        } @else if (featured.error()) {
          <p class="message">Could not load products right now.</p>
        } @else {
          <div class="grid">
            @for (product of featuredCards(); track product.slug; let i = $index) {
              <product-card reveal [revealIndex]="i" [revealStagger]="80" [product]="product" />
            }
          </div>
        }
      </page-container>
    </page-section>

    <page-section spacing="lg">
      <page-container>
        <header class="section-head" reveal>
          <h2>Shop by category</h2>
        </header>

        @if (categories.isLoading()) {
          <div class="categories">
            @for (placeholder of skeletons; track placeholder) {
              <skeleton-block height="220px" radius="var(--radius-lg)" />
            }
          </div>
        } @else {
          <div class="categories">
            @for (category of categories.value() ?? []; track category.id; let i = $index) {
              <a
                class="category"
                reveal
                [revealIndex]="i"
                [revealStagger]="60"
                [routerLink]="['/shop']"
                [queryParams]="{ category: category.id }"
              >
                @if (category.imageUrl) {
                  <img [ngSrc]="category.imageUrl" [alt]="''" fill />
                }
                <span class="category-label">
                  {{ category.name }}
                  <icon-glyph name="arrow-right" [size]="16" />
                </span>
              </a>
            }
          </div>
        }
      </page-container>
    </page-section>

    <sale-banner reveal />

    <page-section spacing="lg">
      <collection-grid reveal />
    </page-section>

    <page-section spacing="lg">
      <latest-articles reveal />
    </page-section>

    <newsletter-signup reveal />

    <page-section spacing="lg">
      <instagram-strip reveal />
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    /* ---------------------------------------------------------- hero */

    // 820px at Figma's 1440px canvas ≈ 57% of viewport width. Scaling that
    // ratio directly makes an absurdly tall mobile hero, so mobile gets a
    // fixed floor and only tablet-up approaches the Figma proportion.
    .hero {
      position: relative;
      display: grid;
      align-items: center;
      min-height: 560px;
      padding-block: calc(var(--space-10) * 2) var(--space-10);
      overflow: hidden;
      isolation: isolate;

      @include bp.tablet-up {
        min-height: 760px;
      }
    }

    .hero-image {
      object-fit: cover;
      z-index: -2;
    }

    /*
     * Figma's own treatment: a left-to-right dark gradient (text sits on
     * the left) layered with a near-black-to-transparent diagonal wash, so
     * the photograph still reads clearly on the right two-thirds.
     */
    .hero-scrim {
      position: absolute;
      inset: 0;
      z-index: -1;
      background:
        linear-gradient(
          to right,
          rgb(18 18 18 / 92%) 0%,
          rgb(18 18 18 / 78%) 40%,
          rgb(18 18 18 / 25%) 75%,
          rgb(18 18 18 / 10%) 100%
        ),
        linear-gradient(to top, rgb(13 13 13 / 45%) 0%, transparent 35%);
    }

    .hero-content {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: var(--space-7);
      max-width: 32rem;

      // Locally shadow the tokens [reveal]'s global transition reads
      // (styles/_motion.scss) so this one authored moment settles on the
      // slower, emphasized "unhurried arc" curve instead of the routine
      // 400ms/ease-out every other [reveal] in the app uses — without
      // touching those tokens, or the directive, for anyone else.
      --duration-slow: var(--duration-slower);
      --ease-out: var(--ease-emphasized);

      h1 {
        @include type.headline-4;
        margin: 0;
        // Figma's own fade: the headline eases in from transparent at the
        // very top and out again at the very bottom rather than sitting at
        // flat full-white the whole block.
        background: linear-gradient(
          180deg,
          rgb(255 255 255 / 0%) 0%,
          rgb(255 255 255 / 100%) 16%,
          rgb(255 255 255 / 100%) 87%,
          rgb(255 255 255 / 0%) 106%
        );
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;

        @include bp.tablet-up {
          @include type.headline-2;
        }
      }

      p {
        @include type.body-1;
        max-width: 42ch;
        margin: 0;
        color: color-mix(in srgb, var(--color-neutral-01) 88%, transparent);
      }
    }

    /* ---------------------------------------------- assurance strip */

    .assurances {
      background: var(--color-neutral-07);
      color: var(--color-neutral-01);

      ul {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--space-4) var(--space-10);
        margin: 0;
        padding: var(--space-4) 0;
      }

      li {
        @include type.caption-1;
        display: flex;
        align-items: center;
        gap: var(--space-2);
      }

      icon-glyph {
        color: var(--color-success);
      }
    }

    /* ------------------------------------------------------ sections */

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
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        color: var(--color-neutral-07);

        icon-glyph {
          transition: transform var(--duration-fast) var(--ease-out);
        }

        &:hover icon-glyph {
          transform: translateX(3px);
        }
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

    /* --------------------------------------------------- categories */

    .categories {
      display: grid;
      gap: var(--space-4);
      grid-template-columns: repeat(2, minmax(0, 1fr));

      @include bp.tablet-up {
        grid-template-columns: repeat(4, minmax(0, 1fr));
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

      /* Keeps the label legible over whatever the photograph happens to be. */
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

    .message {
      @include type.body-2;
      color: var(--color-neutral-04);
    }
  `,
})
export default class Home {
  private readonly catalog = inject(CatalogService);

  protected readonly skeletons = [0, 1, 2, 3];
  protected readonly assurances = ASSURANCES;

  protected readonly featured = this.catalog.productsResource(() => ({
    isFeatured: true,
    take: 4,
  }));

  protected readonly categories = this.catalog.categoryTreeResource();

  protected readonly featuredCards = computed(() =>
    (this.featured.value()?.items ?? []).map(toCardProduct),
  );
}
