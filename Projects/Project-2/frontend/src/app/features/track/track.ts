import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';

import type { OrderStatus, TrackingInfoDto } from '@/app/core/api/dto';
import { OrdersService } from '@/app/core/services/orders.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Order placed',
  paid: 'Payment received',
  payment_failed: 'Payment failed',
  confirmed: 'Order confirmed',
  fulfilled: 'Preparing your order',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

/**
 * Public, unauthenticated — GET /orders/track deliberately returns only
 * {orderNumber, status, city, countryCode, placedAt} and requires the
 * order's own email to see even that much (orders.service.ts on the
 * backend), so there is nothing here worth gating behind a login.
 */
@Component({
  selector: 'track-page',
  imports: [
    RevealDirective,
    FormField,
    DatePipe,
    ActionButton,
    PageContainer,
    PageSection,
    StatusBadge,
    TextField,
  ],
  template: `
    <page-section spacing="md">
      <page-container>
        <div class="shell">
          <h1 reveal>Track your order</h1>
          <p class="subhead" reveal>Enter your order number and the email you used to place it.</p>

          <form class="lookup" (submit)="onSubmit($event)" novalidate reveal>
            <text-field label="Order number" [height]="48" [formField]="lookupForm.orderNumber" />
            <text-field
              label="Email"
              type="email"
              [height]="48"
              autocomplete="email"
              [formField]="lookupForm.email"
            />
            <action-button type="submit" size="m" [fullWidth]="true" [loading]="loading()">
              Track order
            </action-button>
          </form>

          @if (notFound()) {
            <p class="not-found" reveal>
              No order found matching that order number and email. Double-check both and try again.
            </p>
          }

          @if (result(); as info) {
            <div class="result" reveal>
              <p class="order-number">Order #{{ info.orderNumber }}</p>
              <status-badge variant="custom" [background]="'var(--color-neutral-02)'" [color]="'var(--color-neutral-07)'">
                {{ statusLabel[info.status] }}
              </status-badge>
              <p class="detail">
                Shipping to {{ info.city }}, {{ info.countryCode }} · Placed
                {{ info.placedAt | date: 'mediumDate' }}
              </p>
            </div>
          }
        </div>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;

    .shell {
      max-width: 26rem;
      margin: 0 auto;
      padding-block: var(--space-8);
    }

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .subhead {
      @include type.body-2;
      margin: 0 0 var(--space-8);
      color: var(--color-neutral-04);
    }

    .lookup {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .not-found {
      @include type.body-2;
      margin: var(--space-6) 0 0;
      color: var(--color-error);
    }

    .result {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: var(--space-3);
      margin-top: var(--space-8);
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-neutral-02);
    }

    .order-number {
      @include type.body-1-semi;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .detail {
      @include type.caption-1;
      margin: 0;
      color: var(--color-neutral-06);
    }
  `,
})
export default class Track {
  private readonly ordersService = inject(OrdersService);

  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly result = signal<TrackingInfoDto | null>(null);
  protected readonly statusLabel = STATUS_LABEL;

  private readonly model = signal({ orderNumber: '', email: '' });

  protected readonly lookupForm = form(this.model, (f) => {
    required(f.orderNumber, { message: 'Order number is required' });
    required(f.email, { message: 'Email is required' });
    email(f.email, { message: 'Enter a valid email address' });
  });

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.lookupForm().markAsTouched();
    if (!this.lookupForm().valid() || this.loading()) return;

    const { orderNumber, email: emailValue } = this.model();
    this.loading.set(true);
    this.notFound.set(false);
    this.result.set(null);

    this.ordersService.track(orderNumber, emailValue).subscribe({
      next: (info) => {
        this.result.set(info);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }
}
