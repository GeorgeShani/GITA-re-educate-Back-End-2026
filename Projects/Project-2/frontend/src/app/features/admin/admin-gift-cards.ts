import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';

import type { GiftCardDto } from '@/app/core/api/dto';
import { AdminGiftCardsService } from '@/app/core/services/admin-gift-cards.service';
import { ToastService } from '@/app/core/services/toast.service';
import { DataTable } from '@/app/features/admin/ui/data-table';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { EmptyState } from '@/app/features/admin/ui/empty-state';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { ActionButton } from '@/app/shared/ui/action-button';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

@Component({
  selector: 'admin-gift-cards-page',
  imports: [DatePipe, MoneyPipe, ActionButton, DataTable, DrawerForm, EmptyState, PageToolbar, SkeletonBlock, StatusBadge, TextField],
  template: `
    <page-toolbar title="Gift cards" [subtitle]="cards().length + ' total'">
      <action-button size="s" (click)="issueFormOpen.set(true)">Issue gift card</action-button>
    </page-toolbar>

    @if (loading()) {
      <skeleton-block height="280px" width="100%" />
    } @else if (cards().length === 0) {
      <empty-state message="No gift cards issued yet." icon="banknote" />
    } @else {
      <data-table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Balance</th>
            <th>Expires</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (c of cards(); track c.id) {
            <tr>
              <td>{{ c.code }}</td>
              <td data-numeric>{{ c.balanceMinor | money }} / {{ c.initialBalanceMinor | money }}</td>
              <td>{{ c.expiresAt ? (c.expiresAt | date: 'mediumDate') : 'Never' }}</td>
              <td>
                <status-badge variant="custom" [background]="c.isActive ? 'var(--color-success)' : 'var(--color-neutral-03)'" color="var(--color-neutral-07)">
                  {{ c.isActive ? 'Active' : 'Inactive' }}
                </status-badge>
              </td>
              <td class="actions">
                <button type="button" (click)="startAdjust(c)">Adjust balance</button>
                <button type="button" (click)="toggleActive(c)">{{ c.isActive ? 'Deactivate' : 'Activate' }}</button>
              </td>
            </tr>
          }
        </tbody>
      </data-table>
    }

    <drawer-form
      title="Issue gift card"
      [open]="issueFormOpen()"
      [saving]="saving()"
      saveLabel="Issue"
      (openChange)="issueFormOpen.set($event)"
      (cancel)="issueFormOpen.set(false)"
      (save)="issue()"
    >
      <text-field label="Balance (USD)" type="number" [value]="issueBalance()" (valueChange)="issueBalance.set($event)" />
      <text-field label="Expires at (optional)" [value]="issueExpiresAt()" (valueChange)="issueExpiresAt.set($event)" hint="YYYY-MM-DD" />
    </drawer-form>

    <drawer-form
      title="Adjust balance"
      [open]="adjustFormOpen()"
      [saving]="saving()"
      saveLabel="Apply"
      (openChange)="adjustFormOpen.set($event)"
      (cancel)="adjustFormOpen.set(false)"
      (save)="adjust()"
    >
      @if (adjustTarget(); as t) {
        <p class="context">{{ t.code }} — current balance {{ t.balanceMinor | money }}</p>
      }
      <text-field label="Delta (USD, +/-)" type="number" [value]="adjustDelta()" (valueChange)="adjustDelta.set($event)" />
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

    .context {
      @include type.caption-1;
      margin: 0;
      color: var(--color-neutral-05);
    }
  `,
})
export default class AdminGiftCards implements OnInit {
  private readonly giftCardsService = inject(AdminGiftCardsService);
  private readonly toast = inject(ToastService);

  protected readonly cards = signal<GiftCardDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly issueFormOpen = signal(false);
  protected readonly issueBalance = signal('');
  protected readonly issueExpiresAt = signal('');

  protected readonly adjustFormOpen = signal(false);
  protected readonly adjustDelta = signal('');
  protected readonly adjustTarget = signal<GiftCardDto | null>(null);

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.giftCardsService.list(undefined, 1, 100).subscribe({
      next: (result) => {
        this.cards.set(result.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected issue(): void {
    const dollars = Number.parseFloat(this.issueBalance());
    if (!Number.isFinite(dollars) || dollars <= 0) {
      this.toast.show('Enter a positive balance', 'error');
      return;
    }
    this.saving.set(true);
    this.giftCardsService
      .issue({
        balanceMinor: Math.round(dollars * 100),
        expiresAt: this.issueExpiresAt() ? new Date(this.issueExpiresAt()).toISOString() : undefined,
      })
      .subscribe({
        next: (card) => {
          this.saving.set(false);
          this.issueFormOpen.set(false);
          this.toast.show(`Gift card ${card.code} issued`, 'success');
          this.load();
        },
        error: () => this.saving.set(false),
      });
  }

  protected startAdjust(card: GiftCardDto): void {
    this.adjustTarget.set(card);
    this.adjustDelta.set('');
    this.adjustFormOpen.set(true);
  }

  protected adjust(): void {
    const target = this.adjustTarget();
    const dollars = Number.parseFloat(this.adjustDelta());
    if (!target || !Number.isFinite(dollars) || dollars === 0) {
      this.toast.show('Enter a non-zero amount', 'error');
      return;
    }
    this.saving.set(true);
    this.giftCardsService.adjustBalance(target.id, Math.round(dollars * 100)).subscribe({
      next: () => {
        this.saving.set(false);
        this.adjustFormOpen.set(false);
        this.toast.show('Balance adjusted', 'success');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected toggleActive(card: GiftCardDto): void {
    this.giftCardsService.update(card.id, { isActive: !card.isActive }).subscribe(() => {
      this.toast.show(card.isActive ? 'Deactivated' : 'Activated', 'success');
      this.load();
    });
  }
}
