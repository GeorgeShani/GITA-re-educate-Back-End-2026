import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { OrderDto, OrderStatus } from '@/app/core/api/dto';
import { AdminOrdersService } from '@/app/core/services/admin-orders.service';
import { toFilterValue, toUnionValue } from '@/app/core/util/string-union';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { SortHeader, type SortChange } from '@/app/features/admin/ui/sort-header';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { PaginationNav } from '@/app/shared/ui/pagination-nav';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';

const TAKE = 20;
const SORT_FIELDS = ['createdAt', 'status', 'totalMinor'] as const;

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

// Same labels as STATUS_OPTIONS above, keyed for the status-badge display
// rather than the filter dropdown — the table used to print order.status
// straight through instead (the raw "payment_failed" enum value, not
// "Payment failed").
const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Placed',
  paid: 'Paid',
  payment_failed: 'Payment failed',
  confirmed: 'Confirmed',
  fulfilled: 'Fulfilled',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

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
  imports: [
    RouterLink,
    DatePipe,
    MoneyPipe,
    DataTable,
    EmptyState,
    FilterBar,
    PageToolbar,
    PaginationNav,
    SelectField,
    SkeletonBlock,
    SortHeader,
    StatusBadge,
  ],
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
            <th>
              <sort-header
                label="Date"
                field="createdAt"
                [activeField]="sortField()"
                [direction]="sortDirection()"
                (sortChange)="onSortChange($event)"
              />
            </th>
            <th>
              <sort-header
                label="Status"
                field="status"
                [activeField]="sortField()"
                [direction]="sortDirection()"
                (sortChange)="onSortChange($event)"
              />
            </th>
            <th>
              <sort-header
                label="Total"
                field="totalMinor"
                [activeField]="sortField()"
                [direction]="sortDirection()"
                (sortChange)="onSortChange($event)"
              />
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (order of sortedOrders(); track order.id) {
            <tr>
              <td>{{ order.orderNumber }}</td>
              <td>{{ order.createdAt | date: 'medium' }}</td>
              <td>
                <status-badge variant="custom" [background]="statusColor(order.status)" color="var(--color-neutral-07)">
                  {{ statusLabel[order.status] }}
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
  protected readonly statusLabel = STATUS_LABEL;

  protected readonly orders = signal<OrderDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly statusFilter = signal<OrderStatus | ''>('');

  // Client-side, over the current page only — the backend hardcodes
  // .sort({ createdAt: -1 }) with no sort param (admin-orders.service.ts
  // on the backend), so re-sorting the *whole* filtered result set would
  // need a real server-side sort param this phase's runway doesn't cover.
  // Re-ordering the 20 rows already on screen is still a real, honest
  // feature — sort-header.ts never claims otherwise.
  protected readonly sortField = signal<'createdAt' | 'status' | 'totalMinor'>('createdAt');
  protected readonly sortDirection = signal<'asc' | 'desc'>('desc');

  protected readonly sortedOrders = computed(() => {
    const field = this.sortField();
    const direction = this.sortDirection();
    const factor = direction === 'asc' ? 1 : -1;
    return [...this.orders()].sort((a, b) => {
      if (field === 'createdAt') {
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * factor;
      }
      if (field === 'totalMinor') {
        return (a.totalMinor - b.totalMinor) * factor;
      }
      return a.status.localeCompare(b.status) * factor;
    });
  });

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  ngOnInit(): void {
    this.load();
  }

  protected onSortChange(change: SortChange): void {
    const field = toUnionValue(change.field, SORT_FIELDS);
    if (!field) return;
    this.sortField.set(field);
    this.sortDirection.set(change.direction);
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
