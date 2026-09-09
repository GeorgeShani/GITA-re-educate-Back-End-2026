import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { OrderDto, OrderStatus } from '@/app/core/api/dto';
import { AdminOrdersService } from '@/app/core/services/admin-orders.service';
import { toFilterValue } from '@/app/core/util/string-union';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { EmptyState } from '@/app/features/admin/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { PaginationNav } from '@/app/shared/ui/pagination-nav';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';

const TAKE = 20;

const ORDER_STATUSES = [
  'placed',
  'paid',
  'payment_failed',
  'confirmed',
  'fulfilled',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const satisfies readonly OrderStatus[];

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'placed', label: 'Placed' },
  { value: 'paid', label: 'Paid' },
  { value: 'payment_failed', label: 'Payment failed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
];

function statusColor(status: OrderStatus): string {
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

@Component({
  selector: 'admin-orders-page',
  imports: [RouterLink, DatePipe, MoneyPipe, DataTable, EmptyState, FilterBar, PageToolbar, PaginationNav, SelectField, SkeletonBlock, StatusBadge],
  template: `
    <page-toolbar title="Orders" [subtitle]="total() + ' total'"></page-toolbar>

    <filter-bar>
      <select-field label="Status" [options]="statusOptions" [value]="statusFilter()" (valueChange)="onStatusChange($event)" />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (orders().length === 0) {
      <empty-state message="No orders match this filter." icon="banknote" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Date</th>
            <th>Status</th>
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (order of orders(); track order.id) {
            <tr>
              <td>{{ order.orderNumber }}</td>
              <td>{{ order.createdAt | date: 'medium' }}</td>
              <td>
                <status-badge variant="custom" [background]="statusColor(order.status)" color="var(--color-neutral-07)">
                  {{ order.status }}
                </status-badge>
              </td>
              <td data-numeric>{{ order.totalMinor | money }}</td>
              <td><a [routerLink]="[order.id]">View</a></td>
            </tr>
          }
        </tbody>
      </data-table>

      @if (pageCount() > 1) {
        <pagination-nav [page]="page()" [total]="pageCount()" (pageChange)="page.set($event); load()" />
      }
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    td a {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
      text-decoration: underline;
    }

    pagination-nav {
      display: block;
      margin-top: var(--space-6);
    }
  `,
})
export default class AdminOrders implements OnInit {
  private readonly ordersService = inject(AdminOrdersService);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusColor = statusColor;

  protected readonly orders = signal<OrderDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly statusFilter = signal<OrderStatus | ''>('');

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  ngOnInit(): void {
    this.load();
  }

  protected onStatusChange(value: string): void {
    this.statusFilter.set(toFilterValue(value, ORDER_STATUSES));
    this.page.set(1);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.ordersService
      .list({
        status: this.statusFilter() || undefined,
        page: this.page(),
        take: TAKE,
      })
      .subscribe({
        next: (result) => {
          this.orders.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
