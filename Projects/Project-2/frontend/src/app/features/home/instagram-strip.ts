import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';

const IMAGES: readonly string[] = [
  '/images/products/insta-1.jpg',
  '/images/products/insta-2.jpg',
  '/images/products/insta-3.jpg',
  '/images/products/insta-4.jpg',
  '/images/products/insta-5.jpg',
  '/images/products/insta-6.jpg',
];

/**
 * There's no real Instagram account or API integration behind this — the
 * handle is presentational copy matching the brand, not a live feed.
 */
@Component({
  selector: 'instagram-strip',
  imports: [NgOptimizedImage],
  template: `
    <header class="head">
      <p class="eyebrow">Newsfeed</p>
      <h2>Instagram</h2>
      <p class="subhead">Follow us on social media for more discounts &amp; promotions</p>
      <p class="handle">&#64;3legant_golf</p>
    </header>
    <div class="grid">
      @for (image of images; track image) {
        <div class="tile">
          <img [ngSrc]="image" alt="" fill />
        </div>
      }
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    .head {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-4);
      text-align: center;
      margin-bottom: var(--space-8);
    }

    .eyebrow {
      @include type.hairline-1;
      color: var(--color-neutral-04);
    }

    h2 {
      @include type.headline-5;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .subhead {
      @include type.body-1;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .handle {
      @include type.headline-7;
      margin: 0;
      color: var(--color-neutral-04);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 2px;

      @media (min-width: 640px) {
        grid-template-columns: repeat(6, 1fr);
      }
    }

    .tile {
      position: relative;
      aspect-ratio: 1;
      overflow: hidden;
      background: var(--color-neutral-02);

      img {
        object-fit: cover;
        transition: transform var(--duration-slow) var(--ease-out);
      }

      &:hover img {
        transform: scale(1.06);
      }
    }
  `,
})
export class InstagramStrip {
  protected readonly images = IMAGES;
}
