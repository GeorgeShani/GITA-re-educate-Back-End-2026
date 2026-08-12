import { NgOptimizedImage } from '@angular/common';
import {
  Component,
  DestroyRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import type { ProductCategory } from '@/app/core/models/product.model';
import { ProductService } from '@/app/core/services/product.service';
import { ToastService } from '@/app/core/services/toast.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CarouselDots } from '@/app/shared/ui/carousel-dots';
import { CarouselTrack } from '@/app/shared/ui/carousel-track';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { ProductCard, toProductCardProduct } from '@/app/shared/ui/product-card';
import { TextField } from '@/app/shared/ui/text-field';

interface CategoryTile {
  readonly label: string;
  readonly category: ProductCategory;
  readonly image: string;
}

interface CollectionCard {
  readonly label: string;
  readonly size: 'large' | 'small';
}

interface BlogPost {
  readonly title: string;
  readonly image: string;
}

/**
 * Ported from the Figma Homepage 03 design (get_design_context on
 * 116:6824), adapted rather than copied verbatim in two places:
 *
 * - The reference file's own "Shop by Categories" grid (Golf Clubs,
 *   Footwear, Limited Edition...) and product names (e.g. an Air Jordan
 *   sneaker) come from the original generic sports-store template this
 *   was cloned from — this project's real, confirmed category taxonomy
 *   is SCOPE.md A8, which has no clubs category (it's an accessories
 *   store). Categories/products below use that taxonomy instead.
 * - Blog post titles: two of the three reference titles ("...on the
 *   green", "The Ryder Cup") were already golf-appropriate and are kept;
 *   the third (an unrelated sneaker/streetwear event) is swapped.
 *
 * Below-fold sections are @defer (on viewport) — the hero is the LCP
 * element and is never deferred. This is also the first page proving
 * the reveal directive's motion system end to end, per the frontend
 * plan.
 */
@Component({
  selector: 'home-page',
  imports: [
    NgOptimizedImage,
    RouterLink,
    RevealDirective,
    ActionButton,
    CarouselDots,
    CarouselTrack,
    ImagePlaceholder,
    PageContainer,
    PageSection,
    ProductCard,
    TextField,
  ],
  template: `
    <section class="hero">
      <img
        ngSrc="/demo/placeholder-product.svg"
        alt=""
        [fill]="true"
        [priority]="true"
        class="hero__image"
      />
      <page-container class="hero__inner">
        <div class="hero__content">
          <h1 class="hero__title">More than just a game.<br />It's a lifestyle.</h1>
          <action-button routerLink="/shop">Shop Now</action-button>
        </div>
      </page-container>
    </section>

    <page-section>
      <page-container>
        <div class="section-heading" reveal>
          <h2>Featured</h2>
        </div>
        <carousel-track #featuredTrack (activeChange)="carouselActive.set($event)">
          @for (product of featuredProducts(); track product.slug; let i = $index) {
            <div class="carousel-item" reveal [revealIndex]="i" [revealStagger]="60">
              <product-card [product]="product" />
            </div>
          }
        </carousel-track>
        <carousel-dots
          class="carousel-dots-row"
          [count]="featuredProducts().length"
          [active]="carouselActive()"
          (activeChange)="scrollFeatured($event)"
        />
      </page-container>
    </page-section>

    @defer (on viewport) {
      <page-section>
        <page-container>
          <div class="section-heading" reveal>
            <h2>Shop by Categories</h2>
          </div>
          <div class="category-grid">
            @for (tile of categories; track tile.category; let i = $index) {
              <a
                class="category-tile"
                routerLink="/shop"
                [queryParams]="{ category: tile.category }"
                reveal
                [revealIndex]="i"
                [revealStagger]="60"
              >
                <image-placeholder
                  class="category-tile__image"
                  [src]="tile.image"
                  [alt]="''"
                  [width]="357"
                  [height]="240"
                />
                <span class="category-tile__label">{{ tile.label }}</span>
              </a>
            }
          </div>
        </page-container>
      </page-section>
    } @placeholder {
      <div class="section-placeholder"></div>
    }

    @defer (on viewport) {
      <page-section>
        <page-container>
          <div class="limited-banner" reveal>
            <img
              ngSrc="/demo/placeholder-product.svg"
              alt=""
              width="720"
              height="480"
              class="limited-banner__image"
            />
            <div class="limited-banner__content">
              <p class="limited-banner__eyebrow">Limited Edition</p>
              <h2 class="limited-banner__title">Hurry up! 30% OFF</h2>
              <p class="limited-banner__subtitle">Find the gear that's right for your game</p>
              <p class="limited-banner__countdown-label">Offer expires in:</p>
              <div class="countdown">
                <div class="countdown__unit">
                  <span class="countdown__value">{{ countdown().days }}</span>
                  <span class="countdown__label">Days</span>
                </div>
                <div class="countdown__unit">
                  <span class="countdown__value">{{ countdown().hours }}</span>
                  <span class="countdown__label">Hours</span>
                </div>
                <div class="countdown__unit">
                  <span class="countdown__value">{{ countdown().minutes }}</span>
                  <span class="countdown__label">Minutes</span>
                </div>
                <div class="countdown__unit">
                  <span class="countdown__value">{{ countdown().seconds }}</span>
                  <span class="countdown__label">Seconds</span>
                </div>
              </div>
              <action-button routerLink="/shop">Shop Now</action-button>
            </div>
          </div>
        </page-container>
      </page-section>
    } @placeholder {
      <div class="section-placeholder"></div>
    }

    @defer (on viewport) {
      <page-section>
        <page-container>
          <div class="section-heading" reveal>
            <h2>Shop Collection</h2>
          </div>
          <div class="collection-grid">
            @for (card of collections; track card.label; let i = $index) {
              <a
                class="collection-card"
                [class.collection-card--large]="card.size === 'large'"
                routerLink="/shop"
                reveal
                [revealIndex]="i"
                [revealStagger]="60"
              >
                <image-placeholder
                  class="collection-card__image"
                  [src]="'/demo/placeholder-product.svg'"
                  [alt]="''"
                  [width]="548"
                  [height]="card.size === 'large' ? 664 : 320"
                />
                <span class="collection-card__label">{{ card.label }}</span>
                <span class="collection-card__link">Collections</span>
              </a>
            }
          </div>
        </page-container>
      </page-section>
    } @placeholder {
      <div class="section-placeholder"></div>
    }

    @defer (on viewport) {
      <page-section>
        <page-container>
          <div class="section-heading section-heading--split" reveal>
            <h2>Latest Articles</h2>
            <a class="view-more" routerLink="/">View More</a>
          </div>
          <div class="blog-grid">
            @for (post of blogPosts; track post.title; let i = $index) {
              <article class="blog-card" reveal [revealIndex]="i" [revealStagger]="60">
                <image-placeholder
                  class="blog-card__image"
                  [src]="post.image"
                  [alt]="''"
                  [width]="357"
                  [height]="240"
                />
                <h3 class="blog-card__title">{{ post.title }}</h3>
                <a class="blog-card__link" routerLink="/">Read More</a>
              </article>
            }
          </div>
        </page-container>
      </page-section>
    } @placeholder {
      <div class="section-placeholder"></div>
    }

    @defer (on viewport) {
      <page-section spacing="sm" class="newsletter">
        <page-container>
          <div class="newsletter__inner" reveal>
            <h2>Join Our Newsletter</h2>
            <p>Sign up for deals, new products and promotions</p>
            <form class="newsletter__form" (submit)="onSubscribe($event)">
              <text-field
                placeholder="Email address"
                type="email"
                [value]="newsletterEmail()"
                (valueChange)="newsletterEmail.set($event)"
              />
              <action-button type="submit">Signup</action-button>
            </form>
          </div>
        </page-container>
      </page-section>
    } @placeholder {
      <div class="section-placeholder"></div>
    }

    @defer (on viewport) {
      <page-section>
        <page-container>
          <div class="section-heading" reveal>
            <h2>Instagram</h2>
          </div>
          <div class="instagram-grid">
            @for (tile of instagramTiles; track $index; let i = $index) {
              <image-placeholder
                class="instagram-grid__tile"
                [src]="tile"
                [alt]="''"
                [width]="240"
                [height]="240"
                reveal
                [revealIndex]="i"
                [revealStagger]="40"
              />
            }
          </div>
        </page-container>
      </page-section>
    } @placeholder {
      <div class="section-placeholder"></div>
    }
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .hero {
      position: relative;
      display: flex;
      align-items: center;
      block-size: 480px;
      overflow: hidden;
      background: var(--color-neutral-02);

      @include bp.desktop-up {
        block-size: 820px;
      }
    }

    .hero__image {
      object-fit: cover;
    }

    .hero__inner {
      position: relative;
      width: 100%;
    }

    .hero__content {
      max-width: 480px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--space-6);
    }

    .hero__title {
      @include type.headline-3;
      color: var(--color-neutral-07);
    }

    .section-heading {
      margin-bottom: var(--space-6);
    }

    .section-heading h2 {
      @include type.headline-5;
    }

    .section-heading--split {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }

    .view-more {
      @include type.caption-1-semi;
      color: var(--color-neutral-06);
    }

    .carousel-item {
      flex: 0 0 262px;
    }

    .carousel-dots-row {
      display: flex;
      justify-content: center;
      margin-top: var(--space-6);
    }

    .section-placeholder {
      block-size: 400px;
    }

    .category-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-4);

      @include bp.tablet-up {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .category-tile {
      position: relative;
      display: block;
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .category-tile__image {
      width: 100%;
      aspect-ratio: 357 / 240;
    }

    .category-tile__label {
      position: absolute;
      inset-block-end: var(--space-4);
      inset-inline-start: var(--space-4);
      @include type.body-2-semi;
      color: var(--color-white);
    }

    .limited-banner {
      display: grid;
      grid-template-columns: 1fr;
      align-items: center;
      gap: var(--space-8);
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-neutral-02);

      @include bp.tablet-up {
        grid-template-columns: 1fr 1fr;
      }
    }

    .limited-banner__image {
      display: block;
      width: 100%;
      height: auto;
      object-fit: cover;
    }

    .limited-banner__content {
      padding: var(--space-8);
    }

    .limited-banner__eyebrow {
      @include type.caption-1-semi;
      color: var(--color-neutral-04);
      margin-bottom: var(--space-2);
    }

    .limited-banner__title {
      @include type.headline-4;
      margin-bottom: var(--space-3);
    }

    .limited-banner__subtitle {
      @include type.body-2;
      color: var(--color-neutral-05);
      margin-bottom: var(--space-6);
    }

    .limited-banner__countdown-label {
      @include type.caption-1;
      color: var(--color-neutral-04);
      margin-bottom: var(--space-2);
    }

    .countdown {
      display: flex;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .countdown__unit {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 48px;
      padding: var(--space-2);
      border-radius: var(--radius-sm);
      background: var(--color-white);
    }

    .countdown__value {
      @include type.headline-6;
    }

    .countdown__label {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    .collection-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-4);

      @include bp.tablet-up {
        grid-template-columns: 1fr 1fr;
      }
    }

    .collection-card {
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: var(--space-1);
      padding: var(--space-6);
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .collection-card--large {
      @include bp.tablet-up {
        grid-row: span 2;
      }
    }

    .collection-card__image {
      position: absolute;
      inset: 0;
      z-index: -1;
    }

    .collection-card__label {
      @include type.headline-7;
      color: var(--color-white);
    }

    .collection-card__link {
      @include type.caption-1;
      color: var(--color-white);
      text-decoration: underline;
    }

    .blog-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-6);

      @include bp.tablet-up {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .blog-card__image {
      width: 100%;
      aspect-ratio: 357 / 240;
      border-radius: var(--radius-md);
      margin-bottom: var(--space-4);
    }

    .blog-card__title {
      @include type.body-2-semi;
      margin-bottom: var(--space-2);
    }

    .blog-card__link {
      @include type.caption-1-semi;
      color: var(--color-neutral-06);
      text-decoration: underline;
    }

    .newsletter {
      background: var(--color-neutral-02);
    }

    .newsletter__inner {
      text-align: center;
      max-width: 480px;
      margin-inline: auto;
    }

    .newsletter__inner h2 {
      @include type.headline-5;
      margin-bottom: var(--space-2);
    }

    .newsletter__inner p {
      @include type.body-2;
      color: var(--color-neutral-04);
      margin-bottom: var(--space-6);
    }

    .newsletter__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);

      @include bp.tablet-up {
        flex-direction: row;
      }
    }

    .newsletter__form text-field {
      flex: 1;
    }

    .instagram-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-2);

      @include bp.tablet-up {
        grid-template-columns: repeat(6, 1fr);
      }
    }

    .instagram-grid__tile {
      aspect-ratio: 1;
    }
  `,
})
export class HomePage {
  private readonly productService = inject(ProductService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly featuredProducts = toSignal(
    this.productService
      .list({ featured: true })
      .pipe(map((products) => products.map(toProductCardProduct))),
    { initialValue: [] },
  );

  protected readonly carouselActive = signal(0);
  private readonly featuredTrack = viewChild<CarouselTrack>('featuredTrack');

  protected scrollFeatured(index: number): void {
    this.carouselActive.set(index);
    this.featuredTrack()?.scrollTo(index);
  }

  protected readonly categories: CategoryTile[] = [
    { label: 'Gloves', category: 'gloves', image: '/demo/placeholder-product.svg' },
    { label: 'Balls', category: 'balls', image: '/demo/placeholder-product.svg' },
    { label: 'Bags', category: 'bags', image: '/demo/placeholder-product.svg' },
    { label: 'Rangefinders & GPS', category: 'rangefinders-gps', image: '/demo/placeholder-product.svg' },
    { label: 'Apparel', category: 'apparel', image: '/demo/placeholder-product.svg' },
    { label: 'Accessories', category: 'accessories', image: '/demo/placeholder-product.svg' },
  ];

  /**
   * Rendered as all-zeros until afterNextRender confirms a real browser —
   * a countdown is inherently a client-only feature (it has to tick), so
   * unlike a static value there's no "SSR mismatch" to avoid here, just
   * the ordinary reveal-directive-style rule of never computing a clock
   * value during the render that gets sent to the client.
   */
  protected readonly countdown = signal({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  protected readonly collections: CollectionCard[] = [
    { label: "Men's Set", size: 'large' },
    { label: "Women's Set", size: 'small' },
    { label: 'Juniors Set', size: 'small' },
  ];

  protected readonly blogPosts: BlogPost[] = [
    { title: 'The timeless classics on the green', image: '/demo/placeholder-product.svg' },
    { title: 'The 2026 Ryder Cup', image: '/demo/placeholder-product.svg' },
    { title: '5 ways to lower your handicap this season', image: '/demo/placeholder-product.svg' },
  ];

  protected readonly newsletterEmail = signal('');

  protected readonly instagramTiles = Array.from({ length: 6 }, () => '/demo/placeholder-product.svg');

  constructor() {
    afterNextRender(() => {
      const target = new Date('2026-08-20T00:00:00Z').getTime();
      const tick = () => {
        const diff = Math.max(target - Date.now(), 0);
        this.countdown.set({
          days: Math.floor(diff / 86_400_000),
          hours: Math.floor((diff / 3_600_000) % 24),
          minutes: Math.floor((diff / 60_000) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      };
      tick();
      const id = setInterval(tick, 1000);
      this.destroyRef.onDestroy(() => clearInterval(id));
    });
  }

  protected onSubscribe(event: Event): void {
    event.preventDefault();
    if (!this.newsletterEmail()) return;
    this.toastService.show("You're subscribed!", 'success');
    this.newsletterEmail.set('');
  }
}
