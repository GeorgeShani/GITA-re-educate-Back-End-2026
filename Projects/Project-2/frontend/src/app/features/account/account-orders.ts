import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { OrderDto, OrderStatus } from '@/app/core/api/dto';
import { OrdersService } from '@/app/core/services/orders.service';
import { orderStatusMeta } from '@/app/core/util/status-meta';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { EmptyState } from '@/app/shared/ui/empty-state';
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

@Component({
  selector: 'account-orders-page',
  imports: [RouterLink, DatePipe, MoneyPipe, RevealDirective, SkeletonBlock, StatusBadge, EmptyState],
  template: `
    <section reveal>
      <h1>Orders</h1>

      @if (orders(); as list) {
        @if (list.length === 0) {
          <empty-state message="You haven't placed any orders yet." icon="banknote" />
        } @else {
          <ul class="list" role="list">
            @for (order of list; track order.id) {
              <li>
                <a class="card" [routerLink]="[order.id]">
                  <div class="card-main">
                    <strong>Order #{{ order.orderNumber }}</strong>
                    <span class="date">{{ order.createdAt | date: 'mediumDate' }}</span>
                  </div>
                  <status-badge [variant]="statusMeta(order.status).variant">
                    {{ statusLabel[order.status] }}
                  </status-badge>
                  <span class="total" data-numeric>{{ order.totalMinor | money }}</span>
                </a>
              </li>
            }
          </ul>
        }
      } @else {
        <div class="loading">
          <skeleton-block height="72px" width="100%" />
          <skeleton-block height="72px" width="100%" />
        </div>
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

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .card {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      padding: var(--space-5);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }

    .card-main {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }

    .card-main strong {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
    }

    .date {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    .total {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
      white-space: nowrap;
    }

    .loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
  `,
})
export default class AccountOrders implements OnInit {
  private readonly ordersService = inject(OrdersService);

  protected readonly orders = signal<OrderDto[] | null>(null);
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusMeta = orderStatusMeta;

  ngOnInit(): void {
    this.ordersService.listMine().subscribe((result) => this.orders.set(result.items));
  }
}
