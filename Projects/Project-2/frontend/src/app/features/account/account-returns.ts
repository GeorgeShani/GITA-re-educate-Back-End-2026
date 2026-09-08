import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import type { ReturnDto, ReturnStatus } from '@/app/core/api/dto';
import { ReturnsService } from '@/app/core/services/returns.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { StatusBadge } from '@/app/shared/ui/status-badge';

const STATUS_LABEL: Record<ReturnStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  received: 'Received',
  refunded: 'Refunded',
};

@Component({
  selector: 'account-returns-page',
  imports: [RouterLink, DatePipe, RevealDirective, StatusBadge],
  template: `
    <section reveal>
      <div class="head">
        <h1>Returns</h1>
        <a routerLink="/account/orders" class="new-link">Start a return from an order</a>
      </div>

      @if (returns(); as list) {
        @if (list.length === 0) {
          <p class="empty">You have no return requests.</p>
        } @else {
          <ul class="list" role="list">
            @for (ret of list; track ret.id) {
              <li class="card">
                <div class="card-body">
                  <strong>{{ ret.items.length }} item{{ ret.items.length === 1 ? '' : 's' }}</strong>
                  <span class="date">Requested {{ ret.createdAt | date: 'mediumDate' }}</span>
                </div>
                <status-badge variant="custom" [background]="statusBackground(ret.status)" [color]="'var(--color-neutral-07)'">
                  {{ statusLabel[ret.status] }}
                </status-badge>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    h1 {
      @include type.headline-6;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .new-link {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
      text-decoration: underline;
    }

    .empty {
      @include type.body-2;
      color: var(--color-neutral-04);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-5);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }

    .card-body {
      display: flex;
      flex-direction: column;
    }

    .card-body strong {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
    }

    .date {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }
  `,
})
export default class AccountReturns implements OnInit {
  private readonly returnsService = inject(ReturnsService);

  protected readonly returns = signal<ReturnDto[] | null>(null);
  protected readonly statusLabel = STATUS_LABEL;

  ngOnInit(): void {
    this.returnsService.listMine().subscribe((returns) => this.returns.set(returns));
  }

  protected statusBackground(status: ReturnStatus): string {
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
}
