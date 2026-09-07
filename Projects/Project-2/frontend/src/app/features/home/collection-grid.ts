import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { PageContainer } from '@/app/shared/ui/page-container';

interface Collection {
  readonly title: string;
  readonly image: string;
  readonly size: 'large' | 'small';
}

/**
 * "Shop Collection" from Homepage 03 — a marketing grouping (juniors/men's/
 * women's sets) that doesn't correspond to a real category or facet on the
 * backend yet, so these link to the general shop rather than a filtered
 * view. Revisit once the catalog has a size/audience dimension to filter on.
 */
const COLLECTIONS: readonly Collection[] = [
  { title: 'Juniors Set', image: '/images/products/collection-juniors.jpg', size: 'large' },
  { title: "Men's Set", image: '/images/products/collection-mens.jpg', size: 'small' },
  { title: "Women's Set", image: '/images/products/collection-womens.jpg', size: 'small' },
];

@Component({
  selector: 'collection-grid',
  imports: [RouterLink, NgOptimizedImage, IconGlyph, PageContainer],
  template: `
    <page-container>
      <h2>Shop Collection</h2>
      <div class="grid">
        @for (collection of collections; track collection.title) {
          <a class="card" [class.card--large]="collection.size === 'large'" routerLink="/shop">
            <img [ngSrc]="collection.image" alt="" fill />
            <span class="card-content">
              <span class="card-title">{{ collection.title }}</span>
              <span class="card-link">
                Collections
                <icon-glyph name="arrow-right" [size]="18" />
              </span>
            </span>
          </a>
        }
      </div>
    </page-container>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    :host {
      display: block;
    }

    h2 {
      @include type.headline-5;
      margin: 0 0 var(--space-8);
      color: var(--color-neutral-07);

      @include bp.tablet-up {
        @include type.headline-4;
      }
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-6);

      @include bp.tablet-up {
        grid-template-columns: 1fr 1fr;
      }
    }

    .card {
      position: relative;
      display: block;
      overflow: hidden;
      isolation: isolate;
      border-radius: var(--radius-lg);
      aspect-ratio: 4 / 3;
      background: var(--color-neutral-02);

      // Below tablet the large card keeps the shared 4/3 ratio like any
      // other card. At tablet-up it spans both rows of the right column's
      // two stacked cards instead — aspect-ratio would give it its OWN
      // preferred height and stop it from stretching to match theirs
      // (aspect-ratio + a definite width overrides grid's default
      // align-items: stretch), so it's cancelled back to auto here and the
      // spanned row tracks decide the height instead.
      &.card--large {
        @include bp.tablet-up {
          grid-row: span 2;
          aspect-ratio: auto;
        }
      }

      // ::after generates as the LAST box in paint order — after both the
      // <img> and .card-content, even though .card-content is later in the
      // markup — so without explicit z-index the scrim paints over the
      // text instead of behind it. Same negative-stack pattern as
      // .category above: image lowest, scrim above it, text (unset
      // z-index, so effectively 0) on top of both.
      img {
        object-fit: cover;
        z-index: -2;
        transition: transform var(--duration-slow) var(--ease-out);
      }

      &:hover img {
        transform: scale(1.05);
      }

      &::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: -1;
        background: linear-gradient(
          to top,
          rgb(20 23 24 / 75%) 0%,
          rgb(20 23 24 / 15%) 45%,
          transparent 75%
        );
      }
    }

    .card-content {
      position: absolute;
      inset-inline: var(--space-6);
      bottom: var(--space-6);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      color: var(--color-neutral-01);
    }

    .card-title {
      @include type.headline-6;
    }

    .card-link {
      @include type.body-2-semi;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      width: fit-content;
      padding-bottom: var(--space-1);
      border-bottom: 1px solid currentColor;
    }
  `,
})
export class CollectionGrid {
  protected readonly collections = COLLECTIONS;
}
