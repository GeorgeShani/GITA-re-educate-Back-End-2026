import { DestroyRef, Component, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap, takeWhile, timer } from 'rxjs';

import type { OrderDto, OrderStatus } from '@/app/core/api/dto';
import { OrdersService } from '@/app/core/services/orders.service';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 30_000;

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placing your order…',
  paid: 'Payment received',
  payment_failed: 'Payment failed',
  confirmed: 'Order confirmed',
  fulfilled: 'Preparing your order',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/**
 * Polls GET /orders/:id until status leaves 'placed' — the saga that
 * turns a PaymentIntent success into 'paid'/'confirmed' is webhook-driven
 * (checkout.saga.ts on the backend), so there's a real, unpredictable gap
 * between "the card was charged" and "the order reflects it". Gives up
 * after 30s with a "we'll email you" fallback rather than polling forever.
 */
@Component({
  selector: 'order-complete-page',
  imports: [RouterLink, RevealDirective, MoneyPipe, ImagePlaceholder, PageContainer, PageSection, SkeletonBlock, StatusBadge],
  template: `
    <page-section spacing="md">
      <page-container>
        @if (order(); as o) {
          <div class="head" reveal>
            @if (o.status === 'paid' || o.status === 'confirmed') {
              <h1>Thank you for your order!</h1>
            } @else if (o.status === 'payment_failed') {
              <h1>Payment failed</h1>
            } @else {
              <h1>Order received</h1>
            }
            <p class="order-number">Order #{{ o.orderNumber }}</p>
            <status-badge variant="custom" [background]="statusBackground(o.status)" [color]="'var(--color-neutral-07)'">
              {{ statusLabel[o.status] }}
            </status-badge>

            @if (o.status === 'placed' && timedOut()) {
              <p class="note">
                This is taking longer than usual — we'll email you as soon as it's confirmed.
              </p>
            } @else if (o.status === 'placed') {
              <p class="note">Confirming your payment…</p>
            }
          </div>

          <div class="layout" reveal>
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

            <aside class="summary">
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

              <div class="address">
                <h2>Shipping to</h2>
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
            </aside>
          </div>

          <a routerLink="/shop" class="continue" reveal>Continue shopping</a>
        } @else {
          <div class="loading" reveal>
            <skeleton-block height="32px" width="240px" />
            <skeleton-block height="20px" width="160px" />
            <skeleton-block height="120px" width="100%" />
          </div>
        }
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;

    .head {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: var(--space-3);
      margin-bottom: var(--space-8);
    }

    h1 {
      @include type.headline-5;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .order-number {
      @include type.body-2;
      margin: 0;
      color: var(--color-neutral-04);
    }

    .note {
      @include type.caption-1;
      margin: 0;
      color: var(--color-neutral-04);
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-8);
      margin-bottom: var(--space-8);

      @media (min-width: 900px) {
        grid-template-columns: 2fr 1fr;
        align-items: start;
      }
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin: 0;
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

    .address {
      margin-top: var(--space-4);
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

    .continue {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
      text-decoration: underline;
    }

    .loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
  `,
})
export default class OrderComplete implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = input.required<string>();

  protected readonly order = signal<OrderDto | null>(null);
  protected readonly timedOut = signal(false);
  protected readonly statusLabel = STATUS_LABEL;

  ngOnInit(): void {
    const startedAt = Date.now();

    timer(0, POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.ordersService.getOrder(this.orderId())),
        takeWhile((order) => {
          // Stop once the order has a real outcome — 'placed' is the only
          // non-terminal-for-this-purpose status; everything else (paid,
          // confirmed, payment_failed, ...) is worth stopping and showing.
          if (order.status !== 'placed') return false;
          if (Date.now() - startedAt < POLL_TIMEOUT_MS) return true;
          this.timedOut.set(true);
          return false;
        }, true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((order) => this.order.set(order));
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
}
