import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { DashboardSummaryDto } from '@/app/core/api/dto';
import { AdminDashboardService } from '@/app/core/services/admin-dashboard.service';
import { AdminProductLookupService } from '@/app/core/services/admin-product-lookup.service';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { EmptyState } from '@/app/features/admin/ui/empty-state';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { StatTile } from '@/app/features/admin/ui/stat-tile';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

const RANGE_OPTIONS: SelectOption[] = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

/** "order.shipped" -> "order shipped" — every audit-log event name follows this dot-separated convention, no lookup table needed. */
function eventLabel(eventName: string): string {
  return eventName.replace(/[._]/g, ' ');
}

@Component({
  selector: 'admin-dashboard-page',
  imports: [DatePipe, MoneyPipe, EmptyState, PageToolbar, StatTile, SelectField, SkeletonBlock],
  template: `
    <page-toolbar title="Dashboard">
      <select-field [options]="rangeOptions" [value]="rangeDays()" (valueChange)="onRangeChange($event)" />
    </page-toolbar>

    @if (loading()) {
      <div class="tiles">
        <skeleton-block height="96px" width="100%" />
        <skeleton-block height="96px" width="100%" />
        <skeleton-block height="96px" width="100%" />
      </div>
    } @else if (summary(); as s) {
      <div class="tiles">
        <stat-tile label="Revenue" [value]="(s.revenueMinor | money) ?? '—'" [hint]="rangeHint()" />
        <stat-tile label="Orders" [value]="s.orderCount.toString()" [hint]="rangeHint()" />
        <stat-tile label="Average order value" [value]="(s.averageOrderValueMinor | money) ?? '—'" />
      </div>

      <div class="panels">
        <section class="panel">
          <h2>Low stock</h2>
          @if (s.lowStock.length === 0) {
            <empty-state message="Nothing is running low." icon="check" />
          } @else {
            <ul role="list">
              @for (item of s.lowStock; track item.id) {
                <li>
                  <span class="name">{{ productName(item.productId) }}</span>
                  <span class="sku">{{ item.variantSku }}</span>
                  <span class="qty" data-numeric>{{ item.quantityOnHand }} left</span>
                </li>
              }
            </ul>
          }
        </section>

        <section class="panel">
          <h2>Recent activity</h2>
          @if (s.recentActivity.length === 0) {
            <empty-state message="No activity yet." icon="check" />
          } @else {
            <ul role="list">
              @for (entry of s.recentActivity; track entry.id) {
                <li>
                  <span class="name">{{ eventLabel(entry.eventName) }}</span>
                  <span class="date">{{ entry.occurredAt | date: 'short' }}</span>
                </li>
              }
            </ul>
          }
        </section>
      </div>
    }
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .panels {
      display: grid;
      gap: var(--space-6);

      @include bp.wide-up {
        grid-template-columns: 1fr 1fr;
        align-items: start;
      }
    }

    .panel {
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background: var(--color-white);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }

    h2 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding-bottom: var(--space-3);
      border-bottom: 1px solid var(--color-neutral-03);

      &:last-child {
        padding-bottom: 0;
        border-bottom: none;
      }
    }

    .name {
      @include type.caption-1-semi;
      flex: 1;
      min-width: 0;
      color: var(--color-neutral-07);
      text-transform: capitalize;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sku,
    .date {
      @include type.caption-2;
      color: var(--color-neutral-04);
      white-space: nowrap;
    }

    .qty {
      @include type.caption-1-semi;
      color: var(--color-error);
      white-space: nowrap;
    }
  `,
})
export default class AdminDashboard implements OnInit {
  private readonly dashboard = inject(AdminDashboardService);
  private readonly productLookup = inject(AdminProductLookupService);

  protected readonly rangeOptions = RANGE_OPTIONS;
  protected readonly rangeDays = signal('30');
  protected readonly loading = signal(true);
  protected readonly summary = signal<DashboardSummaryDto | null>(null);

  protected readonly rangeHint = computed(() => `Last ${this.rangeDays()} days`);

  ngOnInit(): void {
    this.productLookup.ensureLoaded().subscribe();
    this.load();
  }

  protected onRangeChange(value: string): void {
    this.rangeDays.set(value);
    this.load();
  }

  protected productName(productId: string): string {
    return this.productLookup.get(productId)?.name ?? productId;
  }

  protected eventLabel = eventLabel;

  private load(): void {
    this.loading.set(true);
    const to = new Date();
    const from = new Date(to.getTime() - Number(this.rangeDays()) * 24 * 60 * 60 * 1000);
    this.dashboard.getSummary(from.toISOString(), to.toISOString()).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
