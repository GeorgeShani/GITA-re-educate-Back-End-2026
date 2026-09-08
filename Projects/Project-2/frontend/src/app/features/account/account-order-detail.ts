import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { OrderDto, OrderStatus } from '@/app/core/api/dto';
import { CartService } from '@/app/core/services/cart.service';
import { OrdersService } from '@/app/core/services/orders.service';
import { ToastService } from '@/app/core/services/toast.service';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  paid: 'Paid',
  payment_failed: 'Payment failed',
  confirmed: 'Confirmed',
  fulfilled: 'Preparing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

// Only these statuses have goods a customer could plausibly still return —
// matches the plan's "returns request flow" needing a real completed order.
const RETURNABLE_STATUSES: OrderStatus[] = ['delivered', 'fulfilled', 'shipped'];

@Component({
  selector: 'account-order-detail-page',
  imports: [RouterLink, MoneyPipe, RevealDirective, ActionButton, ImagePlaceholder, SkeletonBlock, StatusBadge],
  template: `
    @if (order(); as o) {
      <section reveal>
        <a routerLink="/account/orders" class="back">← Back to orders</a>

        <div class="head">
          <div>
            <h1>Order #{{ o.orderNumber }}</h1>
            <status-badge variant="custom" [background]="statusBackground(o.status)" [color]="'var(--color-neutral-07)'">
              {{ statusLabel[o.status] }}
            </status-badge>
          </div>
          <div class="head-actions">
            @if (o.invoiceUrl) {
              <a [href]="o.invoiceUrl" target="_blank" rel="noopener" class="invoice-link">Download invoice</a>
            }
            <action-button size="s" variant="secondary" [loading]="reordering()" (click)="reorder()">
              Buy again
            </action-button>
            @if (canReturn()) {
              <action-button size="s" [routerLink]="['/account/returns', 'new']" [queryParams]="{ orderId: o.id }">
                Request a return
              </action-button>
            }
          </div>
        </div>

        <ul class="items" role="list">
          @for (item of o.items; track item._id) {
            <li class="item">
              <image-placeholder [src]="item.imageUrlSnapshot" [alt]="item.nameSnapshot" [width]="64" [height]="64" />
              <div class="item-body">
                <span class="item-name">{{ item.nameSnapshot }}</span>
                <span class="item-sku">{{ item.variantSku }} · Qty {{ item.quantity }}</span>
              </div>
              <span class="item-price" data-numeric>{{ item.lineTotalMinor | money }}</span>
            </li>
          }
        </ul>

        <div class="layout">
          <div class="summary">
            <div class="totals-row">
              <span>Subtotal</span>
              <span data-numeric>{{ o.subtotalMinor | money }}</span>
            </div>
            @if (o.discountMinor > 0) {
              <div class="totals-row">
                <span>Discount</span>
                <span data-numeric>-{{ o.discountMinor | money }}</span>
              </div>
            }
            <div class="totals-row">
              <span>Shipping</span>
              <span data-numeric>{{ o.shippingMinor | money }}</span>
            </div>
            <div class="totals-row">
              <span>Tax</span>
              <span data-numeric>{{ o.taxMinor | money }}</span>
            </div>
            <div class="totals-row totals-final">
              <span>Total</span>
              <span data-numeric>{{ o.totalMinor | money }}</span>
            </div>
          </div>

          <div class="address">
            <h2>Shipping address</h2>
            <p>
              {{ o.shippingAddress.fullName }}<br />
              {{ o.shippingAddress.line1 }}<br />
              @if (o.shippingAddress.line2) {
                {{ o.shippingAddress.line2 }}<br />
              }
              {{ o.shippingAddress.city }}, {{ o.shippingAddress.postalCode }}<br />
              {{ o.shippingAddress.countryCode }}
            </p>
          </div>
        </div>
      </section>
    } @else {
      <div class="loading">
        <skeleton-block height="32px" width="200px" />
        <skeleton-block height="120px" width="100%" />
      </div>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    .back {
      @include type.caption-1-semi;
      display: inline-block;
      margin-bottom: var(--space-4);
      color: var(--color-neutral-04);
    }

    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: start;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-8);
    }

    h1 {
      @include type.headline-6;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .head-actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .invoice-link {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
      text-decoration: underline;
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin: 0 0 var(--space-8);
      padding: 0;
      list-style: none;
    }

    .item {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-neutral-03);

      image-placeholder {
        flex-shrink: 0;
        width: 64px;
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
    }

    .item-body {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .item-name {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
    }

    .item-sku {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    .item-price {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
      white-space: nowrap;
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-6);

      @media (min-width: 700px) {
        grid-template-columns: 1fr 1fr;
      }
    }

    .summary {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-neutral-02);
    }

    .totals-row {
      @include type.body-2;
      display: flex;
      justify-content: space-between;
      color: var(--color-neutral-06);
    }

    .totals-final {
      @include type.body-1-semi;
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-neutral-03);
      color: var(--color-neutral-07);
    }

    .address h2 {
      @include type.caption-1-semi;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .address p {
      @include type.caption-1;
      margin: 0;
      color: var(--color-neutral-06);
    }

    .loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
  `,
})
export default class AccountOrderDetail implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly order = signal<OrderDto | null>(null);
  protected readonly reordering = signal(false);
  protected readonly statusLabel = STATUS_LABEL;

  ngOnInit(): void {
    this.ordersService.getOrder(this.id()).subscribe((order) => this.order.set(order));
  }

  protected canReturn(): boolean {
    const status = this.order()?.status;
    return !!status && RETURNABLE_STATUSES.includes(status);
  }

  protected statusBackground(status: OrderStatus): string {
    switch (status) {
      case 'paid':
      case 'confirmed':
      case 'fulfilled':
      case 'shipped':
      case 'delivered':
        return 'var(--color-success)';
      case 'payment_failed':
      case 'cancelled':
        return 'var(--color-error)';
      default:
        return 'var(--color-neutral-03)';
    }
  }

  protected reorder(): void {
    this.reordering.set(true);
    this.ordersService.reorder(this.id()).subscribe({
      next: () => {
        this.cart.refresh().subscribe();
        this.reordering.set(false);
        this.toast.show('Added to your cart', 'success');
        // See checkout.ts's onPaid() for why this isn't a bare
        // navigateByUrl: withViewTransitions() (app-wide) can leave an
        // in-app navigation stuck without committing the URL — confirmed
        // recurring here too, not unique to the checkout flow.
        this.router.navigateByUrl('/cart').then((succeeded) => {
          if (!succeeded) window.location.href = '/cart';
        });
      },
      error: () => this.reordering.set(false),
    });
  }
}
