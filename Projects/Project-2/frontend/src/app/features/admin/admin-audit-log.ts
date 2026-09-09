import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { AuditLogEntryDto, AuditLogQuery } from '@/app/core/api/dto';
import { AdminAuditLogService } from '@/app/core/services/admin-audit-log.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { DrawerPanel } from '@/app/shared/ui/drawer-panel';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { TextField } from '@/app/shared/ui/text-field';

const TAKE = 30;

@Component({
  selector: 'admin-audit-log-page',
  imports: [DataTable, DatePipe, DrawerPanel, EmptyState, FilterBar, PageToolbar, SkeletonBlock, TextField],
  template: `
    <page-toolbar title="Audit log" [subtitle]="total() + ' events'"></page-toolbar>

    <filter-bar>
      <text-field label="Event name" placeholder="order.shipped" [value]="eventName()" (valueChange)="onFilterChange('eventName', $event)" />
      <text-field label="Aggregate type" placeholder="Order" [value]="aggregateType()" (valueChange)="onFilterChange('aggregateType', $event)" />
      <text-field label="Aggregate id" [value]="aggregateId()" (valueChange)="onFilterChange('aggregateId', $event)" />
      <text-field label="Correlation id" [value]="correlationId()" (valueChange)="onFilterChange('correlationId', $event)" />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="400px" width="100%" />
    } @else if (entries().length === 0) {
      <empty-state message="No events match this filter." icon="sliders-horizontal" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Aggregate</th>
            <th>Occurred</th>
            <th>Correlation id</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (e of entries(); track e.id) {
            <tr>
              <td class="event-name">{{ e.eventName }}</td>
              <td>{{ e.aggregateType }} · {{ e.aggregateId }}</td>
              <td>{{ e.occurredAt | date: 'medium' }}</td>
              <td class="correlation">{{ e.correlationId }}</td>
              <td class="actions">
                <button type="button" (click)="viewPayload(e)">View payload</button>
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-panel side="right" [open]="payloadOpen()" (openChange)="payloadOpen.set($event)">
      @if (selected(); as e) {
        <h2>{{ e.eventName }}</h2>
        <p class="meta">{{ e.aggregateType }} · {{ e.aggregateId }}</p>
        <p class="meta">{{ e.occurredAt | date: 'medium' }}</p>
        <pre>{{ formattedPayload() }}</pre>
      }
    </drawer-panel>
  `,
  styles: `
    @use 'styles/typography' as type;

    .event-name {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
    }

    .correlation {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    td.actions button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
      white-space: nowrap;
    }

    h2 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .meta {
      @include type.caption-1;
      margin: 0 0 var(--space-1);
      color: var(--color-neutral-05);
    }

    pre {
      @include type.caption-2;
      margin-top: var(--space-4);
      padding: var(--space-4);
      overflow-x: auto;
      border-radius: var(--radius-md);
      background: var(--color-neutral-01);
      color: var(--color-neutral-07);
      white-space: pre-wrap;
      word-break: break-word;
    }
  `,
})
export default class AdminAuditLog implements OnInit {
  private readonly auditLogService = inject(AdminAuditLogService);

  protected readonly entries = signal<AuditLogEntryDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);

  protected readonly eventName = signal('');
  protected readonly aggregateType = signal('');
  protected readonly aggregateId = signal('');
  protected readonly correlationId = signal('');

  protected readonly payloadOpen = signal(false);
  protected readonly selected = signal<AuditLogEntryDto | null>(null);
  protected readonly formattedPayload = computed(() => JSON.stringify(this.selected()?.payload ?? {}, null, 2));

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  private filterTimeout: ReturnType<typeof setTimeout> | undefined;

  ngOnInit(): void {
    this.load();
  }

  protected onFilterChange(field: 'eventName' | 'aggregateType' | 'aggregateId' | 'correlationId', value: string): void {
    this[field].set(value);
    clearTimeout(this.filterTimeout);
    this.filterTimeout = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 400);
  }

  private load(): void {
    this.loading.set(true);
    const query: AuditLogQuery = {
      eventName: this.eventName().trim() || undefined,
      aggregateType: this.aggregateType().trim() || undefined,
      aggregateId: this.aggregateId().trim() || undefined,
      correlationId: this.correlationId().trim() || undefined,
      page: this.page(),
      take: TAKE,
    };
    this.auditLogService.list(query).subscribe({
      next: (result) => {
        this.entries.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected viewPayload(entry: AuditLogEntryDto): void {
    this.selected.set(entry);
    this.payloadOpen.set(true);
  }
}
