import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import type { EmailCategory, EmailMessageDto, EmailStatus } from '@/app/core/api/dto';
import { AdminEmailService } from '@/app/core/services/admin-email.service';
import { ToastService } from '@/app/core/services/toast.service';
import { toFilterValue } from '@/app/core/util/string-union';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { FilterBar } from '@/app/features/admin/ui/filter-bar';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { ActionButton } from '@/app/shared/ui/action-button';
import { SelectField, type SelectOption } from '@/app/shared/ui/select-field';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

const TAKE = 25;

const EMAIL_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'failed',
] as const satisfies readonly EmailStatus[];

const EMAIL_CATEGORIES = [
  'transactional',
  'security',
  'ops',
  'marketing',
  'opt-in',
] as const satisfies readonly EmailCategory[];

const STATUS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'sent', label: 'Sent' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'complained', label: 'Complained' },
  { value: 'failed', label: 'Failed' },
];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: '', label: 'All' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'security', label: 'Security' },
  { value: 'ops', label: 'Ops' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'opt-in', label: 'Opt-in' },
];

const RESENDABLE: EmailStatus[] = ['failed', 'bounced'];

function statusColor(status: EmailStatus): string {
  switch (status) {
    case 'delivered':
    case 'sent':
      return 'var(--color-success)';
    case 'bounced':
    case 'complained':
    case 'failed':
      return 'var(--color-error)';
    default:
      return 'var(--color-neutral-03)';
  }
}

@Component({
  selector: 'admin-email-page',
  imports: [ActionButton, DataTable, DatePipe, EmptyState, FilterBar, PageToolbar, SelectField, SkeletonBlock, StatusBadge, TextField],
  template: `
    <page-toolbar title="Email log" [subtitle]="total() + ' total'"></page-toolbar>

    <filter-bar>
      <select-field label="Status" [options]="statusOptions" [value]="statusFilter()" (valueChange)="onStatusChange($event)" />
      <select-field label="Category" [options]="categoryOptions" [value]="categoryFilter()" (valueChange)="onCategoryChange($event)" />
      <text-field label="Recipient" placeholder="name@example.com" [value]="toFilter()" (valueChange)="onToFilterChange($event)" />
    </filter-bar>

    @if (loading()) {
      <skeleton-block height="320px" width="100%" />
    } @else if (messages().length === 0) {
      <empty-state message="No emails match this filter." icon="mail" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>To</th>
            <th>Subject</th>
            <th>Template</th>
            <th>Category</th>
            <th>Status</th>
            <th>Sent</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (m of messages(); track m.id) {
            <tr>
              <td>{{ m.to }}</td>
              <td>{{ m.subject }}</td>
              <td>{{ m.template }}</td>
              <td>{{ m.category }}</td>
              <td>
                <status-badge variant="custom" [background]="statusColor(m.status)" color="var(--color-neutral-07)">
                  {{ m.status }}
                </status-badge>
                @if (m.error) {
                  <p class="error">{{ m.error }}</p>
                }
              </td>
              <td>{{ m.createdAt | date: 'medium' }}</td>
              <td class="actions">
                @if (canResend(m.status)) {
                  <button type="button" (click)="resend(m)">Resend</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <section class="suppression-panel">
      <h2>Suppression list</h2>
      <p class="hint">
        There's no way to list suppressed addresses (the API only supports adding or removing one by exact
        address) — use this if support needs to un-suppress someone who fixed a bounced inbox.
      </p>
      <div class="row">
        <text-field label="Email address" placeholder="name@example.com" [value]="suppressionEmail()" (valueChange)="suppressionEmail.set($event)" />
        <action-button size="s" variant="secondary" (click)="addSuppression()">Suppress</action-button>
        <action-button size="s" variant="ghost" (click)="removeSuppression()">Remove suppression</action-button>
      </div>
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    td.actions button {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
      white-space: nowrap;
    }

    .error {
      @include type.caption-2;
      max-width: 220px;
      margin: var(--space-1) 0 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--color-error);
    }

    .suppression-panel {
      padding: var(--space-5);
      margin-top: var(--space-8);
      border-radius: var(--radius-lg);
      background: var(--color-white);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }

    h2 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .hint {
      @include type.caption-1;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-05);
    }

    .row {
      display: flex;
      align-items: flex-end;
      gap: var(--space-4);
      max-width: 560px;
    }

    .row text-field {
      flex: 1;
    }
  `,
})
export default class AdminEmail implements OnInit {
  private readonly emailService = inject(AdminEmailService);
  private readonly toast = inject(ToastService);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly statusColor = statusColor;

  protected readonly messages = signal<EmailMessageDto[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly statusFilter = signal<EmailStatus | ''>('');
  protected readonly categoryFilter = signal<EmailCategory | ''>('');
  protected readonly toFilter = signal('');

  protected readonly suppressionEmail = signal('');

  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  ngOnInit(): void {
    this.load();
  }

  protected canResend(status: EmailStatus): boolean {
    return RESENDABLE.includes(status);
  }

  protected onStatusChange(value: string): void {
    this.statusFilter.set(toFilterValue(value, EMAIL_STATUSES));
    this.page.set(1);
    this.load();
  }

  protected onCategoryChange(value: string): void {
    this.categoryFilter.set(toFilterValue(value, EMAIL_CATEGORIES));
    this.page.set(1);
    this.load();
  }

  private toFilterTimeout: ReturnType<typeof setTimeout> | undefined;

  protected onToFilterChange(value: string): void {
    this.toFilter.set(value);
    clearTimeout(this.toFilterTimeout);
    this.toFilterTimeout = setTimeout(() => {
      this.page.set(1);
      this.load();
    }, 400);
  }

  private load(): void {
    this.loading.set(true);
    this.emailService
      .listMessages({
        status: this.statusFilter() || undefined,
        category: this.categoryFilter() || undefined,
        to: this.toFilter().trim() || undefined,
        page: this.page(),
        take: TAKE,
      })
      .subscribe({
        next: (result) => {
          this.messages.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected resend(message: EmailMessageDto): void {
    this.emailService.resend(message.id).subscribe({
      next: () => {
        this.toast.show('Email re-queued', 'success');
        this.load();
      },
    });
  }

  protected addSuppression(): void {
    const email = this.suppressionEmail().trim();
    if (!email) return;
    this.emailService.addSuppression(email).subscribe(() => {
      this.toast.show(`${email} suppressed`, 'success');
      this.suppressionEmail.set('');
    });
  }

  protected removeSuppression(): void {
    const email = this.suppressionEmail().trim();
    if (!email) return;
    this.emailService.removeSuppression(email).subscribe(() => {
      this.toast.show(`${email} removed from suppression list`, 'success');
      this.suppressionEmail.set('');
    });
  }
}
