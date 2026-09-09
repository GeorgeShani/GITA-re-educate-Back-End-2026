import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { NewsletterSubscriberDto } from '@/app/core/api/dto';
import { AdminNewsletterService } from '@/app/core/services/admin-newsletter.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { ActionButton } from '@/app/shared/ui/action-button';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';

const TAKE = 50;

function statusOf(s: NewsletterSubscriberDto): { label: string; color: string } {
  if (s.unsubscribedAt) return { label: 'Unsubscribed', color: 'var(--color-neutral-03)' };
  if (s.confirmedAt) return { label: 'Confirmed', color: 'var(--color-success)' };
  return { label: 'Pending', color: 'var(--color-info)' };
}

@Component({
  selector: 'admin-newsletter-page',
  imports: [ActionButton, DataTable, DatePipe, EmptyState, PageToolbar, SkeletonBlock, StatusBadge],
  template: `
    <page-toolbar title="Newsletter" [subtitle]="total() + ' subscribers'">
      <!-- The export endpoint returns plain JSON (no CSV serializer exists server-side), so this opens the raw export rather than claiming a CSV download. -->
      <action-button size="s" variant="secondary" (click)="exportSubscribers()">Export confirmed (JSON)</action-button>
    </page-toolbar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (subscribers().length === 0) {
      <empty-state message="No subscribers yet." icon="circle-user" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Confirmed</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          @for (s of subscribers(); track s.id) {
            <tr>
              <td>{{ s.email }}</td>
              <td>{{ s.confirmedAt ? (s.confirmedAt | date: 'mediumDate') : '—' }}</td>
              <td>
                <status-badge variant="custom" [background]="statusOf(s).color" color="var(--color-neutral-07)">
                  {{ statusOf(s).label }}
                </status-badge>
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }
  `,
  styles: `
    // A long address (subject line-length local part, a long domain) had
    // nothing stopping it from forcing the whole table wider than its
    // container — every other admin table either has short cell content
    // or an action link to anchor a max-width against; this one didn't.
    td:first-child {
      overflow-wrap: anywhere;
    }
  `,
})
export default class AdminNewsletter implements OnInit {
  private readonly newsletterService = inject(AdminNewsletterService);

  protected readonly statusOf = statusOf;

  protected readonly subscribers = signal<NewsletterSubscriberDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.newsletterService.listSubscribers({ page: this.page(), take: TAKE }).subscribe({
      next: (result) => {
        this.subscribers.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected exportSubscribers(): void {
    this.newsletterService.exportSubscribersBlob().subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }
}
