import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { CartLineDto } from '@/app/core/api/dto';
import { AuthService } from '@/app/core/services/auth.service';
import { CartService } from '@/app/core/services/cart.service';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { IconButton } from '@/app/shared/ui/icon-button';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { QuantityStepper } from '@/app/shared/ui/quantity-stepper';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { TextField } from '@/app/shared/ui/text-field';

const QUANTITY_DEBOUNCE_MS = 500;

/**
 * `CartSummaryDto` only ever carries a subtotal — no tax, shipping, or
 * total exists until `GET /checkout/quote`. Showing anything more here
 * would be inventing a number the API never gave us.
 */
@Component({
  selector: 'cart-page',
  imports: [
    RouterLink,
    MoneyPipe,
    RevealDirective,
    ActionButton,
    IconButton,
    ImagePlaceholder,
    PageContainer,
    PageSection,
    QuantityStepper,
    SkeletonBlock,
    TextField,
  ],
  template: `
    <page-section spacing="md">
      <page-container>
        <h1 reveal>Your Cart</h1>

        @if (cart.loading()) {
          <div class="layout">
            <ul class="items" role="list">
              @for (n of skeletonRows; track n) {
                <li class="item">
                  <skeleton-block width="96px" height="96px" radius="var(--radius-md)" />
                  <div class="item-body">
                    <skeleton-block height="20px" width="70%" radius="var(--radius-sm)" />
                    <skeleton-block height="16px" width="40%" radius="var(--radius-sm)" />
                  </div>
                </li>
              }
            </ul>
            <skeleton-block height="280px" radius="var(--radius-lg)" />
          </div>
        } @else if (cart.isEmpty()) {
          <div class="empty" reveal>
            <p>Your cart is empty.</p>
            <action-button routerLink="/shop">Continue shopping</action-button>
          </div>
        } @else {
          <div class="layout">
            <ul class="items" role="list" reveal>
              @for (item of cart.items(); track item.itemId; let i = $index) {
                <li class="item" reveal [revealIndex]="i" [revealStagger]="60">
                  <a class="item-image" [routerLink]="['/product', item.productSlug]">
                    <image-placeholder [src]="item.imageUrl" [alt]="item.productName" [width]="96" [height]="96" />
                  </a>

                  <div class="item-body">
                    <div class="item-head">
                      <a class="item-name" [routerLink]="['/product', item.productSlug]">
                        {{ item.productName }}
                      </a>
                      <icon-button
                        icon="trash-2"
                        ariaLabel="Remove from cart"
                        (clicked)="remove(item)"
                      />
                    </div>
                    @if (variantSummary(item); as summary) {
                      <p class="item-variant">{{ summary }}</p>
                    }

                    <div class="item-foot">
                      <quantity-stepper
                        [value]="displayQuantity(item)"
                        [max]="99"
                        [disabled]="removing().has(item.itemId)"
                        (valueChange)="onQuantityChange(item, $event)"
                      />
                      <span class="item-total" data-numeric>
                        {{ displayQuantity(item) * item.unitPriceMinor | money }}
                      </span>
                    </div>
                  </div>
                </li>
              }
            </ul>

            <aside class="summary" reveal>
              <div class="coupon">
                @if (cart.couponCode(); as code) {
                  <div class="coupon-applied">
                    <span>Code <strong>{{ code }}</strong> applied</span>
                    <button type="button" class="coupon-remove" (click)="removeCoupon()">
                      Remove
                    </button>
                  </div>
                } @else {
                  <form class="coupon-form" (submit)="applyCoupon($event)">
                    <text-field
                      placeholder="Discount code"
                      [value]="couponInput()"
                      (valueChange)="couponInput.set($event)"
                    />
                    <action-button
                      type="submit"
                      variant="secondary"
                      size="s"
                      [disabled]="!couponInput().trim()"
                      [loading]="applyingCoupon()"
                    >
                      Apply
                    </action-button>
                  </form>
                }
              </div>

              <div class="totals">
                <div class="totals-row">
                  <span>Subtotal</span>
                  <span data-numeric>{{ cart.subtotalMinor() | money }}</span>
                </div>
                <p class="totals-note">Shipping and tax calculated at checkout.</p>
              </div>

              <action-button size="m" [fullWidth]="true" (click)="checkout()">
                Checkout
              </action-button>
            </aside>
          </div>
        }
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-8);
      color: var(--color-neutral-07);
    }

    .empty {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: var(--space-6);
    }

    .empty p {
      @include type.body-1;
      color: var(--color-neutral-04);
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-8);

      @include bp.tablet-up {
        grid-template-columns: 2fr 1fr;
        align-items: start;
      }
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: flex;
      gap: var(--space-4);
      padding-bottom: var(--space-6);
      border-bottom: 1px solid var(--color-neutral-03);
    }

    .item-image {
      flex-shrink: 0;
      width: 96px;
      border-radius: var(--radius-md);
      overflow: hidden;
    }

    .item-body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      flex: 1;
      min-width: 0;
    }

    .item-head {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: var(--space-3);
    }

    .item-name {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
    }

    .item-variant {
      @include type.caption-1;
      margin: 0;
      color: var(--color-neutral-04);
    }

    .item-foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: auto;
    }

    .item-total {
      @include type.body-2-semi;
      color: var(--color-price);
    }

    .summary {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-neutral-02);
    }

    .coupon-form {
      display: flex;
      align-items: end;
      gap: var(--space-2);

      text-field {
        flex: 1;
      }
    }

    .coupon-applied {
      @include type.caption-1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      color: var(--color-neutral-07);
    }

    .coupon-remove {
      @include type.caption-1-semi;
      color: var(--color-neutral-04);
      text-decoration: underline;
    }

    .totals {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding-block: var(--space-4);
      border-block: 1px solid var(--color-neutral-03);
    }

    .totals-row {
      @include type.body-1-semi;
      display: flex;
      justify-content: space-between;
      color: var(--color-neutral-07);
    }

    .totals-note {
      @include type.caption-2;
      margin: 0;
      color: var(--color-neutral-04);
    }
  `,
})
export default class Cart {
  protected readonly cart = inject(CartService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly couponInput = signal('');
  protected readonly applyingCoupon = signal(false);
  protected readonly removing = signal<Set<string>>(new Set());
  protected readonly skeletonRows = [0, 1, 2];

  /**
   * Overlays the real cart with in-flight quantity edits. Cleared for an
   * item once CartService's own state reflects the change (success) or
   * the request fails — either way, falling back to the real value IS
   * the rollback, no separate "previous value" bookkeeping needed.
   */
  private readonly optimisticQuantities = signal<Record<string, number>>({});
  private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  protected displayQuantity(item: CartLineDto): number {
    return this.optimisticQuantities()[item.itemId] ?? item.quantity;
  }

  protected variantSummary(item: CartLineDto): string {
    return Object.entries(item.variantAttributes)
      .map(([key, value]) => `${key}: ${value}`)
      .join(' · ');
  }

  protected onQuantityChange(item: CartLineDto, quantity: number): void {
    this.optimisticQuantities.update((map) => ({ ...map, [item.itemId]: quantity }));

    const existingTimer = this.pendingTimers.get(item.itemId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
      this.pendingTimers.delete(item.itemId);
      this.cart.updateQuantity(item.itemId, quantity).subscribe({
        next: () => this.clearOptimistic(item.itemId),
        error: () => this.clearOptimistic(item.itemId),
      });
    }, QUANTITY_DEBOUNCE_MS);
    this.pendingTimers.set(item.itemId, timer);
  }

  private clearOptimistic(itemId: string): void {
    this.optimisticQuantities.update((map) => {
      const { [itemId]: _removed, ...rest } = map;
      return rest;
    });
  }

  protected remove(item: CartLineDto): void {
    this.removing.update((set) => new Set(set).add(item.itemId));
    this.cart.removeItem(item.itemId).subscribe({
      complete: () => {
        this.removing.update((set) => {
          const next = new Set(set);
          next.delete(item.itemId);
          return next;
        });
      },
    });
  }

  protected applyCoupon(event: SubmitEvent): void {
    event.preventDefault();
    const code = this.couponInput().trim();
    if (!code || this.applyingCoupon()) return;

    this.applyingCoupon.set(true);
    this.cart.applyCoupon(code).subscribe({
      next: () => {
        this.applyingCoupon.set(false);
        this.couponInput.set('');
      },
      error: () => this.applyingCoupon.set(false),
    });
  }

  protected removeCoupon(): void {
    this.cart.removeCoupon().subscribe();
  }

  /**
   * No guest checkout — Order.userId is required server-side. A guest
   * gets sent to sign in first; POST /cart/merge already fires from
   * sign-in/sign-up right after a successful login (see sign-in.ts).
   */
  protected checkout(): void {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl('/checkout');
    } else {
      void this.router.navigate(['/sign-in'], { queryParams: { redirectTo: '/checkout' } });
    }
  }
}
