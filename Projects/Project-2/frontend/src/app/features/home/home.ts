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
import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { ProductCard, toProductCardProduct } from '@/app/shared/ui/product-card';

interface CategoryTile {
  readonly label: string;
  /** Omitted for tiles with no matching entry in SCOPE.md A8's taxonomy (Golf Clubs, Footwear) — they link to /shop unfiltered. */
  readonly category?: ProductCategory;
  readonly image: string;
}

interface CollectionCard {
  readonly label: string;
  readonly size: 'large' | 'small';
  readonly image: string;
}

interface BlogPost {
  readonly title: string;
  readonly image: string;
}

/**
 * Ported from the Figma Homepage 03 design (get_design_context on
 * 116:6824 / 176:13558), using the design's real photography and copy
 * throughout — every image below is a downloaded Figma asset
 * (public/images/homepage/, public/images/products/), not a
 * placeholder. Two category tiles (Golf Clubs, Footwear) have no
 * matching entry in SCOPE.md A8's taxonomy, so they keep the design's
 * real label/image but link to /shop unfiltered rather than a fabricated
 * category. Blog post titles/images are used verbatim from the design,
 * including one ("Air Jordan x Travis Scott Event") that's off-topic for
 * a golf store — flagged rather than silently swapped, since guessing at
 * "on-brand" substitutions here previously produced the wrong fix.
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
    IconGlyph,
    ImagePlaceholder,
    PageContainer,
    PageSection,
    ProductCard,
  ],
  template: `
    <section class="hero">
      <img
        ngSrc="/images/homepage/hero.jpg"
        alt=""
        [fill]="true"
        [priority]="true"
        class="hero__image"
      />
      <page-container class="hero__inner">
        <div class="hero__content">
          <h1 class="hero__title">More than just a game.<br />It's a lifestyle.</h1>
          <p class="hero__subtitle">
            Whether you're just starting out, have played your whole life or you're a Tour pro,
            your swing is like a fingerprint.
          </p>
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
                [queryParams]="tile.category ? { category: tile.category } : null"
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
              ngSrc="/images/homepage/banner-limited-edition.jpg"
              alt=""
              width="720"
              height="480"
              class="limited-banner__image"
            />
            <div class="limited-banner__content">
              <p class="limited-banner__eyebrow">Limited Edition</p>
              <h2 class="limited-banner__title">Hurry up! 30% OFF</h2>
              <p class="limited-banner__subtitle">Find clubs that are right for your game</p>
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
                  [src]="card.image"
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
      <section class="newsletter">
        <img
          ngSrc="/images/homepage/newsletter-left.jpg"
          alt=""
          width="900"
          height="600"
          class="newsletter__image newsletter__image--left"
        />
        <img
          ngSrc="/images/homepage/newsletter-right.jpg"
          alt=""
          width="600"
          height="900"
          class="newsletter__image newsletter__image--right"
        />
        <div class="newsletter__content" reveal>
          <div class="newsletter__header">
            <h2>Join Our Newsletter</h2>
            <p>Sign up for deals, new products and promotions</p>
          </div>
          <form class="newsletter__form" (submit)="onSubscribe($event)">
            <icon-glyph name="email" [size]="24" />
            <input
              class="newsletter__input"
              type="email"
              placeholder="Email address"
              [value]="newsletterEmail()"
              (input)="newsletterEmail.set($any($event.target).value)"
              required
            />
            <button type="submit" class="newsletter__submit">Signup</button>
          </form>
        </div>
      </section>
    } @placeholder {
      <div class="section-placeholder"></div>
    }

    @defer (on viewport) {
      <page-section>
        <page-container>
          <div class="instagram-heading" reveal>
            <p class="instagram-heading__eyebrow">newsfeed</p>
            <h2>Instagram</h2>
            <p class="instagram-heading__subtitle">Follow us on social media for more discount & promotions</p>
            <p class="instagram-heading__handle">{{ '@3legant_official' }}</p>
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

    .hero__subtitle {
      @include type.body-1;
      color: var(--color-neutral-05);
    }

    .section-heading {
      margin-bottom: var(--space-6);
    }

    .section-heading h2 {
      @include type.headline-5;
      color: var(--color-brand);
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
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      block-size: 360px;
      overflow: hidden;
      background: var(--color-neutral-07);
      padding-inline: var(--space-6);
    }

    .newsletter__image {
      position: absolute;
      inset-block: 0;
      block-size: 100%;
      inline-size: 45%;
      object-fit: cover;
    }

    .newsletter__image--left {
      inset-inline-start: 0;
      object-position: right center;
    }

    .newsletter__image--right {
      inset-inline-end: 0;
      object-position: left center;
    }

    .newsletter__content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-8);
      max-width: 540px;
      text-align: center;
      color: var(--color-white);
    }

    .newsletter__header {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .newsletter__header h2 {
      @include type.headline-4;
    }

    .newsletter__header p {
      @include type.body-1;
    }

    .newsletter__form {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      inline-size: 100%;
      max-width: 488px;
      block-size: 52px;
      border-block-end: 1px solid var(--color-white);
    }

    .newsletter__form icon-glyph {
      flex-shrink: 0;
      color: var(--color-white);
    }

    .newsletter__input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: none;
      outline: none;
      color: var(--color-white);
      @include type.button-s;
    }

    .newsletter__input::placeholder {
      color: var(--color-white);
      opacity: 0.85;
    }

    .newsletter__submit {
      flex-shrink: 0;
      background: none;
      border: none;
      padding: 0;
      color: var(--color-white);
      cursor: pointer;
      @include type.button-s;
    }

    .instagram-heading {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      text-align: center;
      margin-bottom: var(--space-6);
    }

    .instagram-heading__eyebrow {
      @include type.hairline-1;
      color: var(--color-neutral-04);
      text-transform: uppercase;
    }

    .instagram-heading h2 {
      @include type.headline-4;
      color: var(--color-neutral-07);
    }

    .instagram-heading__subtitle {
      @include type.body-1;
      color: var(--color-neutral-07);
    }

    .instagram-heading__handle {
      @include type.headline-7;
      color: var(--color-neutral-04);
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
    { label: 'Golf Clubs', image: '/images/homepage/category-golf-clubs.jpg' },
    { label: 'Golf Balls', category: 'balls', image: '/images/homepage/category-golf-balls.jpg' },
    { label: 'Golf Bags', category: 'bags', image: '/images/homepage/category-golf-bags.jpg' },
    { label: 'Clothing & Rainwear', category: 'apparel', image: '/images/homepage/category-clothing-rainwear.jpg' },
    { label: 'Footwear', image: '/images/homepage/category-footwear.jpg' },
    { label: 'Accessories', category: 'accessories', image: '/images/homepage/category-accessories.jpg' },
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
    { label: 'Juniors Set', size: 'large', image: '/images/homepage/collection-juniors-set.jpg' },
    { label: "Men's Set", size: 'small', image: '/images/homepage/collection-mens-set.jpg' },
    { label: "Women's Set", size: 'small', image: '/images/homepage/collection-womens-set.jpg' },
  ];

  protected readonly blogPosts: BlogPost[] = [
    { title: 'Air Jordan x Travis Scott Event', image: '/images/homepage/blog-air-jordan-travis-scott.jpg' },
    { title: 'The timeless classics on the green', image: '/images/homepage/blog-timeless-classics.jpg' },
    { title: 'The 2023 Ryder Cup', image: '/images/homepage/blog-ryder-cup.jpg' },
  ];

  protected readonly newsletterEmail = signal('');

  protected readonly instagramTiles = [
    '/images/homepage/instagram-1.jpg',
    '/images/homepage/instagram-2.jpg',
    '/images/homepage/instagram-3.jpg',
    '/images/homepage/instagram-4.jpg',
    '/images/homepage/instagram-5.jpg',
    '/images/homepage/instagram-6.jpg',
  ];

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
