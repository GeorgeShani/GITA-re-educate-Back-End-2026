import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { ReturnDto, ReturnStatus } from '@/app/core/api/dto';
import { AdminReturnsService } from '@/app/core/services/admin-returns.service';
import { ToastService } from '@/app/core/services/toast.service';
import { toFilterValue } from '@/app/core/util/string-union';
import { AdminConfirmService } from '@/app/features/admin/ui/admin-confirm.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

const TAKE = 20;

const RETURN_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'received',
  'refunded',
] as const satisfies readonly ReturnStatus[];

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All statuses' },
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'received', label: 'Received' },
  { value: 'refunded', label: 'Refunded' },
];

function statusColor(status: ReturnStatus): string {
  switch (status) {
    case 'approved':
    case 'received':
    case 'refunded':
      return 'var(--color-success)';
    case 'rejected':
      return 'var(--color-error)';
    default:
      return 'var(--color-neutral-03)';
  }
}

/** The RMA queue — one page combines list + inline actions rather than a separate detail route, since every action here (approve/reject/receive/refund) only ever needs the row's own id and a short admin note. */
@Component({
  selector: 'admin-returns-page',
  imports: [DatePipe, DataTable, DrawerForm, EmptyState, FilterBar, PageToolbar, SelectField, SkeletonBlock, StatusBadge, TextField],
  template: `
    <page-toolbar title="Returns" [subtitle]="total() + ' total'"></page-toolbar>

    <filter-bar>
      <select-field label="Status" [options]="statusOptions" [value]="statusFilter()" (valueChange)="onStatusChange($event)" />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (returns().length === 0) {
      <empty-state message="No returns match this filter." icon="truck" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Requested</th>
            <th>Items</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of returns(); track r.id) {
            <tr>
              <td>{{ r.createdAt | date: 'medium' }}</td>
              <td>{{ r.items.length }} item(s)</td>
              <td>
                <status-badge variant="custom" [background]="statusColor(r.status)" color="var(--color-neutral-07)">
                  {{ r.status }}
                </status-badge>
              </td>
              <td class="actions">
                @if (r.status === 'requested') {
                  <button type="button" (click)="approve(r)">Approve</button>
                  <button type="button" class="danger" (click)="startReject(r)">Reject</button>
                }
                @if (r.status === 'approved') {
                  <button type="button" (click)="receive(r)">Mark received</button>
                }
                @if (r.status === 'received') {
                  <button type="button" (click)="refund(r)">Refund</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      title="Reject return"
      [open]="rejectFormOpen()"
      [saving]="acting()"
      saveLabel="Reject"
      (openChange)="rejectFormOpen.set($event)"
      (cancel)="rejectFormOpen.set(false)"
      (save)="reject()"
    >
      <text-field label="Reason (required)" [value]="rejectNote()" (valueChange)="rejectNote.set($event)" />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    td.actions {
      display: flex;
      gap: var(--space-3);
      white-space: nowrap;
    }

    td.actions button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
    }

    td.actions .danger {
      color: var(--color-error);
    }
  `,
})
export default class AdminReturns implements OnInit {
  private readonly returnsService = inject(AdminReturnsService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(AdminConfirmService);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusColor = statusColor;

  protected readonly returns = signal<ReturnDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly statusFilter = signal<ReturnStatus | ''>('');

  protected readonly rejectFormOpen = signal(false);
  protected readonly rejectNote = signal('');
  private rejectTarget: ReturnDto | null = null;

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  ngOnInit(): void {
    this.load();
  }

  protected onStatusChange(value: string): void {
    this.statusFilter.set(toFilterValue(value, RETURN_STATUSES));
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.returnsService
      .list({ status: this.statusFilter() || undefined, page: this.page(), take: TAKE })
      .subscribe({
        next: (result) => {
          this.returns.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected approve(r: ReturnDto): void {
    this.confirmService
      .confirm({ title: 'Approve this return?', message: 'The customer will be asked to ship the item(s) back.' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.returnsService.approve(r.id).subscribe(() => {
          this.toast.show('Return approved', 'success');
          this.load();
        });
      });
  }

  protected startReject(r: ReturnDto): void {
    this.rejectTarget = r;
    this.rejectNote.set('');
    this.rejectFormOpen.set(true);
  }

  protected reject(): void {
    if (!this.rejectTarget || !this.rejectNote().trim()) {
      this.toast.show('A reason is required', 'error');
      return;
    }
    this.acting.set(true);
    this.returnsService.reject(this.rejectTarget.id, this.rejectNote().trim()).subscribe({
      next: () => {
        this.acting.set(false);
        this.rejectFormOpen.set(false);
        this.toast.show('Return rejected', 'success');
        this.load();
      },
      error: () => this.acting.set(false),
    });
  }

  protected receive(r: ReturnDto): void {
    this.returnsService.receive(r.id).subscribe(() => {
      this.toast.show('Marked received', 'success');
      this.load();
    });
  }

  protected refund(r: ReturnDto): void {
    this.confirmService
      .confirm({ title: 'Refund this return?', message: 'The amount is computed from its line items.', confirmLabel: 'Refund' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.returnsService.refund(r.id).subscribe(() => {
          this.toast.show('Refund issued', 'success');
          this.load();
        });
      });
  }
}
