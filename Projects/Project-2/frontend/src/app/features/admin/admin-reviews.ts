import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { AdminReviewDto, ReviewStatus } from '@/app/core/api/dto';
import { AdminProductLookupService } from '@/app/core/services/admin-product-lookup.service';
import { AdminReviewsService } from '@/app/core/services/admin-reviews.service';
import { ToastService } from '@/app/core/services/toast.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/features/admin/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

const TAKE = 20;

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function statusColor(status: ReviewStatus): string {
  if (status === 'approved') return 'var(--color-success)';
  if (status === 'rejected') return 'var(--color-error)';
  return 'var(--color-neutral-03)';
}

@Component({
  selector: 'admin-reviews-page',
  imports: [DatePipe, DataTable, DrawerForm, EmptyState, FilterBar, PageToolbar, SelectField, SkeletonBlock, StatusBadge, TextField],
  template: `
    <page-toolbar title="Reviews" [subtitle]="total() + ' total'"></page-toolbar>

    <filter-bar>
      <select-field label="Status" [options]="statusOptions" [value]="statusFilter()" (valueChange)="onStatusChange($event)" />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (reviews().length === 0) {
      <empty-state message="Nothing in this queue." icon="star" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Rating</th>
            <th>Body</th>
            <th>Date</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (r of reviews(); track r.id) {
            <tr>
              <td>{{ productName(r.productId) }}</td>
              <td data-numeric>{{ r.rating }} / 5</td>
              <td class="body">{{ r.body }}</td>
              <td>{{ r.createdAt | date: 'mediumDate' }}</td>
              <td>
                <status-badge variant="custom" [background]="statusColor(r.status)" color="var(--color-neutral-07)">
                  {{ r.status }}
                </status-badge>
              </td>
              <td class="actions">
                @if (r.status === 'pending') {
                  <button type="button" (click)="approve(r)">Approve</button>
                  <button type="button" class="danger" (click)="reject(r)">Reject</button>
                }
                <button type="button" (click)="startReply(r)">Reply</button>
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      title="Reply to review"
      [open]="replyFormOpen()"
      [saving]="acting()"
      saveLabel="Post reply"
      (openChange)="replyFormOpen.set($event)"
      (cancel)="replyFormOpen.set(false)"
      (save)="reply()"
    >
      <text-field label="Reply" [value]="replyText()" (valueChange)="replyText.set($event)" />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;

    .body {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

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
export default class AdminReviews implements OnInit {
  private readonly reviewsService = inject(AdminReviewsService);
  private readonly productLookup = inject(AdminProductLookupService);
  private readonly toast = inject(ToastService);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusColor = statusColor;

  protected readonly reviews = signal<AdminReviewDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);
  protected readonly statusFilter = signal('pending');

  protected readonly replyFormOpen = signal(false);
  protected readonly replyText = signal('');
  private replyTarget: AdminReviewDto | null = null;

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  ngOnInit(): void {
    this.productLookup.ensureLoaded().subscribe();
    this.load();
  }

  protected productName(productId: string): string {
    return this.productLookup.get(productId)?.name ?? productId;
  }

  protected onStatusChange(value: string): void {
    this.statusFilter.set(value);
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.reviewsService
      .list({ status: (this.statusFilter() || undefined) as ReviewStatus | undefined, page: this.page(), take: TAKE })
      .subscribe({
        next: (result) => {
          this.reviews.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected approve(r: AdminReviewDto): void {
    this.reviewsService.approve(r.id).subscribe(() => {
      this.toast.show('Review approved', 'success');
      this.load();
    });
  }

  protected reject(r: AdminReviewDto): void {
    this.reviewsService.reject(r.id).subscribe(() => {
      this.toast.show('Review rejected', 'success');
      this.load();
    });
  }

  protected startReply(r: AdminReviewDto): void {
    this.replyTarget = r;
    this.replyText.set(r.adminReply ?? '');
    this.replyFormOpen.set(true);
  }

  protected reply(): void {
    if (!this.replyTarget || !this.replyText().trim()) return;
    this.acting.set(true);
    this.reviewsService.reply(this.replyTarget.id, this.replyText().trim()).subscribe({
      next: () => {
        this.acting.set(false);
        this.replyFormOpen.set(false);
        this.toast.show('Reply posted', 'success');
        this.load();
      },
      error: () => this.acting.set(false),
    });
  }
}
