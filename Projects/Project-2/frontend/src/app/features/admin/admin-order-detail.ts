import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { OrderDto, OrderStatus } from '@/app/core/api/dto';
import { AdminOrdersService } from '@/app/core/services/admin-orders.service';
import { ToastService } from '@/app/core/services/toast.service';
import { AdminConfirmService } from '@/app/features/admin/ui/admin-confirm.service';
import { DrawerForm } from '@/app/features/admin/ui/drawer-form';
import { PageToolbar } from '@/app/features/admin/ui/page-toolbar';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { ActionButton } from '@/app/shared/ui/action-button';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { StatusBadge } from '@/app/shared/ui/status-badge';
import { TextField } from '@/app/shared/ui/text-field';

const SHIPPABLE: OrderStatus[] = ['confirmed'];
const DELIVERABLE: OrderStatus[] = ['shipped'];
const REFUNDABLE: OrderStatus[] = ['confirmed', 'fulfilled', 'shipped', 'delivered'];

function statusColor(status: OrderStatus): string {
  switch (status) {
    case 'paid':
    case 'confirmed':
    case 'fulfilled':
    case 'shipped':
    case 'delivered':
      return 'var(--color-success)';
    case 'payment_failed':
    case 'cancelled':
      return 'var(--color-error)';
    default:
      return 'var(--color-neutral-03)';
  }
}

@Component({
  selector: 'admin-order-detail-page',
  imports: [RouterLink, DatePipe, MoneyPipe, ActionButton, DrawerForm, PageToolbar, SkeletonBlock, StatusBadge, TextField],
  template: `
    <a routerLink="/admin/orders" class="back">← Back to orders</a>

    @if (order(); as o) {
      <page-toolbar [title]="'Order #' + o.orderNumber" [subtitle]="'Placed ' + (o.createdAt | date: 'medium')">
        <a [href]="'/api/v1/admin/orders/' + o.id + '/packing-slip'" (click)="downloadPackingSlip($event, o.id)">
          Packing slip (PDF)
        </a>
        @if (canShip(o.status)) {
          <action-button size="s" variant="secondary" (click)="shipFormOpen.set(true)">Ship</action-button>
        }
        @if (canDeliver(o.status)) {
          <action-button size="s" variant="secondary" (click)="markDelivered()">Mark delivered</action-button>
        }
        @if (canRefund(o.status)) {
          <action-button size="s" variant="secondary" (click)="refundFormOpen.set(true)">Refund</action-button>
        }
      </page-toolbar>

      <status-badge variant="custom" [background]="statusColor(o.status)" color="var(--color-neutral-07)">
        {{ o.status }}
      </status-badge>

      <div class="grid">
        <section class="panel">
          <h2>Items</h2>
          <ul role="list">
            @for (item of o.items; track item._id) {
              <li>
                <span class="name">{{ item.nameSnapshot }}</span>
                <span class="sku">{{ item.variantSku }} × {{ item.quantity }}</span>
                <span data-numeric>{{ item.lineTotalMinor | money }}</span>
              </li>
            }
          </ul>
        </section>

        <section class="panel">
          <h2>Totals</h2>
          <div class="row"><span>Subtotal</span><span data-numeric>{{ o.subtotalMinor | money }}</span></div>
          @if (o.discountMinor > 0) {
            <div class="row"><span>Discount</span><span data-numeric>-{{ o.discountMinor | money }}</span></div>
          }
          <div class="row"><span>Shipping</span><span data-numeric>{{ o.shippingMinor | money }}</span></div>
          <div class="row"><span>Tax</span><span data-numeric>{{ o.taxMinor | money }}</span></div>
          <div class="row total"><span>Total</span><span data-numeric>{{ o.totalMinor | money }}</span></div>
        </section>

        <section class="panel">
          <h2>Shipping address</h2>
          <p>
            {{ o.shippingAddress.fullName }}<br />
            {{ o.shippingAddress.line1 }}<br />
            @if (o.shippingAddress.line2) {
              {{ o.shippingAddress.line2 }}<br />
            }
            {{ o.shippingAddress.city }}, {{ o.shippingAddress.postalCode }}<br />
            {{ o.shippingAddress.countryCode }}
          </p>
        </section>
      </div>
    } @else if (loading()) {
      <skeleton-block height="240px" width="100%" />
    }

    <drawer-form
      title="Ship order"
      [open]="shipFormOpen()"
      [saving]="acting()"
      saveLabel="Mark shipped"
      (openChange)="shipFormOpen.set($event)"
      (cancel)="shipFormOpen.set(false)"
      (save)="ship()"
    >
      <text-field label="Carrier (optional)" [value]="carrier()" (valueChange)="carrier.set($event)" />
      <text-field label="Tracking number (optional)" [value]="trackingNumber()" (valueChange)="trackingNumber.set($event)" />
      <text-field label="Tracking URL (optional)" [value]="trackingUrl()" (valueChange)="trackingUrl.set($event)" />
    </drawer-form>

    <drawer-form
      title="Issue a refund"
      [open]="refundFormOpen()"
      [saving]="acting()"
      saveLabel="Issue refund"
      (openChange)="refundFormOpen.set($event)"
      (cancel)="refundFormOpen.set(false)"
      (save)="refund()"
    >
      <text-field label="Amount (USD, blank = full refund)" type="number" [value]="refundAmount()" (valueChange)="refundAmount.set($event)" />
      <text-field label="Reason (optional)" [value]="refundReason()" (valueChange)="refundReason.set($event)" />
    </drawer-form>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .back {
      @include type.caption-1-semi;
      display: inline-block;
      margin-bottom: var(--space-4);
      color: var(--color-neutral-04);
    }

    page-toolbar a {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
      text-decoration: underline;
    }

    status-badge {
      display: inline-block;
      margin: var(--space-4) 0 var(--space-6);
    }

    .grid {
      display: grid;
      gap: var(--space-6);

      @include bp.wide-up {
        grid-template-columns: 1fr 1fr;
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
    }

    .name {
      @include type.caption-1-semi;
      flex: 1;
      color: var(--color-neutral-07);
    }

    .sku {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    .row {
      @include type.body-2;
      display: flex;
      justify-content: space-between;
      color: var(--color-neutral-06);
    }

    .row.total {
      @include type.body-1-semi;
      padding-top: var(--space-2);
      border-top: 1px solid var(--color-neutral-03);
      color: var(--color-neutral-07);
    }

    p {
      @include type.caption-1;
      margin: 0;
      color: var(--color-neutral-06);
    }
  `,
})
export default class AdminOrderDetail implements OnInit {
  private readonly ordersService = inject(AdminOrdersService);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(AdminConfirmService);

  readonly id = input.required<string>();

  protected readonly order = signal<OrderDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly acting = signal(false);

  protected readonly shipFormOpen = signal(false);
  protected readonly carrier = signal('');
  protected readonly trackingNumber = signal('');
  protected readonly trackingUrl = signal('');

  protected readonly refundFormOpen = signal(false);
  protected readonly refundAmount = signal('');
  protected readonly refundReason = signal('');

  protected readonly statusColor = statusColor;

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.ordersService.getOne(this.id()).subscribe({
      next: (order) => {
        this.order.set(order);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected canShip(status: OrderStatus): boolean {
    return SHIPPABLE.includes(status);
  }

  protected canDeliver(status: OrderStatus): boolean {
    return DELIVERABLE.includes(status);
  }

  protected canRefund(status: OrderStatus): boolean {
    return REFUNDABLE.includes(status);
  }

  protected ship(): void {
    this.acting.set(true);
    this.ordersService
      .ship(this.id(), {
        carrier: this.carrier().trim() || undefined,
        trackingNumber: this.trackingNumber().trim() || undefined,
        trackingUrl: this.trackingUrl().trim() || undefined,
      })
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.acting.set(false);
          this.shipFormOpen.set(false);
          this.toast.show('Order marked shipped', 'success');
        },
        error: () => this.acting.set(false),
      });
  }

  protected markDelivered(): void {
    this.confirmService
      .confirm({ title: 'Mark this order delivered?', message: 'This confirms the customer received their order.' })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.ordersService.markDelivered(this.id()).subscribe((order) => {
          this.order.set(order);
          this.toast.show('Order marked delivered', 'success');
        });
      });
  }

  protected refund(): void {
    this.acting.set(true);
    const amount = this.refundAmount().trim();
    this.ordersService
      .refund(this.id(), {
        amountMinor: amount ? Math.round(Number.parseFloat(amount) * 100) : undefined,
        reason: this.refundReason().trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.acting.set(false);
          this.refundFormOpen.set(false);
          this.toast.show('Refund issued', 'success');
          this.load();
        },
        error: () => this.acting.set(false),
      });
  }

  protected downloadPackingSlip(event: Event, orderId: string): void {
    event.preventDefault();
    this.ordersService.getPackingSlipBlob(orderId).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }
}
