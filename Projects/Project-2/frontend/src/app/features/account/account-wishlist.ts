import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { WishlistService } from '@/app/core/services/wishlist.service';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { IconButton } from '@/app/shared/ui/icon-button';

@Component({
  selector: 'account-wishlist-page',
  imports: [RouterLink, MoneyPipe, RevealDirective, ImagePlaceholder, IconButton],
  template: `
    <section reveal>
      <h1>Wishlist</h1>

      @if (wishlist.items().length === 0) {
        <p class="empty">Nothing saved yet — tap the heart on a product to add it here.</p>
      } @else {
        <ul class="grid" role="list">
          @for (entry of wishlist.items(); track entry.productId) {
            <li class="card">
              @if (entry.product; as product) {
                <a [routerLink]="['/product', product.slug]" class="card-image">
                  <image-placeholder [src]="product.image?.url" [alt]="product.image?.alt ?? product.name" [width]="180" [height]="180" />
                </a>
                <div class="card-body">
                  <a [routerLink]="['/product', product.slug]" class="card-name">{{ product.name }}</a>
                  <span class="card-price" data-numeric>{{ product.basePriceMinor | money }}</span>
                </div>
              } @else {
                <div class="card-body">
                  <span class="card-name unavailable">No longer available</span>
                </div>
              }
              <icon-button
                icon="trash-2"
                ariaLabel="Remove from wishlist"
                (clicked)="remove(entry.productId)"
              />
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    h1 {
      @include type.headline-6;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-07);
    }

    .empty {
      @include type.body-2;
      color: var(--color-neutral-04);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-5);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);

      icon-button {
        position: absolute;
        top: var(--space-2);
        right: var(--space-2);
        background: var(--color-white);
        border-radius: var(--radius-full);
      }
    }

    .card-image {
      display: block;
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .card-name {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
    }

    .unavailable {
      color: var(--color-neutral-04);
      font-style: italic;
    }

    .card-price {
      @include type.caption-1;
      color: var(--color-price);
    }
  `,
})
export default class AccountWishlist implements OnInit {
  protected readonly wishlist = inject(WishlistService);

  ngOnInit(): void {
    this.wishlist.load().subscribe();
  }

  protected remove(productId: string): void {
    this.wishlist.remove(productId).subscribe();
  }
}
