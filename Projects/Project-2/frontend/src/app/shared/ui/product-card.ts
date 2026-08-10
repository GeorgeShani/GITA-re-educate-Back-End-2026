import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ActionButton } from './action-button';
import { IconButton } from './icon-button';
import { ImagePlaceholder } from './image-placeholder';
import { PriceTag } from './price-tag';
import { RatingStars } from './rating-stars';
import { StatusBadge, type StatusBadgeVariant } from './status-badge';

export interface ProductCardBadge {
  readonly label: string;
  readonly variant: StatusBadgeVariant;
}

export interface ProductCardProduct {
  readonly slug: string;
  readonly name: string;
  readonly image: string;
  readonly price: number;
  readonly originalPrice?: number;
  readonly rating?: number;
  readonly reviewCount?: number;
  readonly badges?: ProductCardBadge[];
}

/**
 * The most-reused composite (52 instances across the Figma file). Per
 * SCOPE.md A5: 262x433 desktop / 231x392 mobile / 231x412 on Homepage 04
 * overall, image area 262x349, badges inset 16px with 8px gap, content
 * starts 12px below the image with the block itself: rating -> title
 * -> price, 4px internal gap. Card width is fluid (100%) rather than
 * switching between the three measured sizes directly — sized by
 * whatever grid/carousel/flex container places it, with the image
 * locked to the measured 262:349 ratio regardless of rendered width.
 *
 * Not resolved: SCOPE.md separately notes "price row with 12px gap",
 * which doesn't square with the 4px block-wide gap — could mean the
 * price row's own internal gap (current vs. original price) is 12px,
 * overriding price-tag's default 8px, but that's a guess. Left as-is
 * (price-tag's own 8px) pending a real Figma check.
 *
 * Hover state (image zoom + quick-add reveal) is not in the Figma file —
 * a deliberate addition, recorded in SCOPE.md per the frontend plan.
 * `/product/:slug` doesn't exist until Phase F5; the link is wired now
 * so nothing needs to change when that route lands.
 */
@Component({
  selector: 'product-card',
  imports: [RouterLink, ImagePlaceholder, StatusBadge, RatingStars, PriceTag, ActionButton, IconButton],
  template: `
    <article class="product-card">
      <a class="product-card__media" [routerLink]="['/product', product().slug]">
        <image-placeholder
          class="product-card__image"
          [src]="product().image"
          [alt]="product().name"
          [width]="262"
          [height]="349"
        />
        @if (product().badges?.length) {
          <div class="product-card__badges">
            @for (badge of product().badges; track badge.label) {
              <status-badge [variant]="badge.variant">{{ badge.label }}</status-badge>
            }
          </div>
        }
        <icon-button
          icon="heart"
          ariaLabel="Add to wishlist"
          class="product-card__wishlist"
          [pressed]="wishlisted()"
          (click)="$event.stopPropagation()"
          (clicked)="wishlistToggled.emit()"
        />
        <action-button
          class="product-card__quick-add"
          size="s"
          [fullWidth]="true"
          (click)="$event.stopPropagation(); $event.preventDefault(); quickAdd.emit()"
        >
          Quick Add
        </action-button>
      </a>
      <div class="product-card__content">
        @if (product().rating; as rating) {
          <rating-stars [value]="rating" [count]="product().reviewCount" />
        }
        <a class="product-card__name" [routerLink]="['/product', product().slug]">
          {{ product().name }}
        </a>
        <price-tag [price]="product().price" [originalPrice]="product().originalPrice" />
      </div>
    </article>
  `,
  styles: `
    @use 'styles/typography' as type;

    .product-card {
      display: flex;
      flex-direction: column;
      width: 100%;
      scroll-snap-align: start;
    }

    // image-placeholder's <img> lives inside ITS OWN encapsulated template
    // — a normal descendant selector from here can't reach it. Scaling
    // .product-card__image (image-placeholder's host, applied via the
    // class on the tag) scales its rendered content along with it, which
    // reads identically since the host's own background is a flat fill
    // behind the photo. .product-card__media needs overflow: hidden so
    // the zoom clips at the card edge instead of spilling out.
    .product-card__media {
      position: relative;
      display: block;
      overflow: hidden;
    }

    .product-card__image {
      aspect-ratio: 262 / 349;
      width: 100%;
      transition: transform var(--duration-slow) var(--ease-out);
    }

    .product-card__media:hover .product-card__image {
      transform: scale(1.05);
    }

    .product-card__badges {
      position: absolute;
      inset-block-start: 16px;
      inset-inline-start: 16px;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .product-card__wishlist {
      position: absolute;
      inset-block-start: var(--space-3);
      inset-inline-end: var(--space-3);
      background: var(--color-white);
      border-radius: var(--radius-full);
    }

    .product-card__quick-add {
      position: absolute;
      inset-inline: var(--space-3);
      inset-block-end: var(--space-3);
      opacity: 0;
      transform: translateY(4px);
      transition:
        opacity var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out);
    }

    .product-card__media:hover .product-card__quick-add,
    .product-card__media:focus-within .product-card__quick-add {
      opacity: 1;
      transform: translateY(0);
    }

    .product-card__content {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin-top: 12px;
    }

    .product-card__name {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
    }
  `,
})
export class ProductCard {
  readonly product = input.required<ProductCardProduct>();
  readonly wishlisted = input(false);
  readonly wishlistToggled = output<void>();
  readonly quickAdd = output<void>();
}
