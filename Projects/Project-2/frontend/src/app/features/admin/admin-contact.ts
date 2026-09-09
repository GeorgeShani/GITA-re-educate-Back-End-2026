import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { AdminContactMessageDto } from '@/app/core/api/dto';
import { AdminContactService } from '@/app/core/services/admin-contact.service';
import { ToastService } from '@/app/core/services/toast.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';

const TAKE = 20;

const READ_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

@Component({
  selector: 'admin-contact-page',
  imports: [DataTable, DatePipe, EmptyState, FilterBar, PageToolbar, SelectField, SkeletonBlock, StatusBadge],
  template: `
    <page-toolbar title="Contact inbox" [subtitle]="total() + ' total'"></page-toolbar>

    <filter-bar>
      <select-field label="Status" [options]="readOptions" [value]="readFilter()" (valueChange)="onReadFilterChange($event)" />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (messages().length === 0) {
      <empty-state message="No messages match this filter." icon="mail" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>From</th>
            <th>Subject</th>
            <th>Message</th>
            <th>Date</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (m of messages(); track m.id) {
            <tr [class.unread]="!m.isRead">
              <td>
                <span class="name">{{ m.name }}</span>
                <span class="email">{{ m.email }}</span>
              </td>
              <td>{{ m.subject || '—' }}</td>
              <td class="body">{{ m.message }}</td>
              <td>{{ m.createdAt | date: 'medium' }}</td>
              <td>
                <status-badge variant="custom" [background]="m.isRead ? 'var(--color-neutral-03)' : 'var(--color-info)'" color="var(--color-neutral-07)">
                  {{ m.isRead ? 'Read' : 'Unread' }}
                </status-badge>
              </td>
              <td class="actions">
                @if (!m.isRead) {
                  <button type="button" (click)="markRead(m)">Mark read</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    tr.unread {
      background: color-mix(in srgb, var(--color-info) 6%, transparent);
    }

    .name {
      @include type.caption-1-semi;
      display: block;
      color: var(--color-neutral-07);
    }

    .email {
      @include type.caption-2;
      display: block;
      color: var(--color-neutral-04);
    }

    .body {
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    td.actions button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
      white-space: nowrap;
    }
  `,
})
export default class AdminContact implements OnInit {
  private readonly contactService = inject(AdminContactService);
  private readonly toast = inject(ToastService);

  protected readonly readOptions = READ_OPTIONS;

  protected readonly messages = signal<AdminContactMessageDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly readFilter = signal('');

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  ngOnInit(): void {
    this.load();
  }

  protected onReadFilterChange(value: string): void {
    this.readFilter.set(value);
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    const isRead = this.readFilter() === '' ? undefined : this.readFilter() === 'read';
    this.contactService.list({ isRead, page: this.page(), take: TAKE }).subscribe({
      next: (result) => {
        this.messages.set(result.items);
        this.total.set(result.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected markRead(message: AdminContactMessageDto): void {
    this.contactService.markRead(message.id).subscribe(() => {
      this.toast.show('Marked as read', 'success');
      this.load();
    });
  }
}
