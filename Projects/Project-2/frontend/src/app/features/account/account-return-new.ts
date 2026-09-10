import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

import type { OrderDto, OrderStatus } from '@/app/core/api/dto';
import { OrdersService } from '@/app/core/services/orders.service';
import { ReturnsService } from '@/app/core/services/returns.service';
import { ToastService } from '@/app/core/services/toast.service';
import { inputValue } from '@/app/core/util/dom-event';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { EmptyState } from '@/app/shared/ui/empty-state';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { QuantityStepper } from '@/app/shared/ui/quantity-stepper';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

interface ReturnLineState {
  orderItemId: string;
  selected: boolean;
  quantity: number;
  reason: string;
}

// Only orders that have actually shipped can be returned; the rest have
// nothing to send back yet (or never will).
const RETURNABLE: readonly OrderStatus[] = ['shipped', 'delivered', 'fulfilled'];

/**
 * POST /returns. Normally reached from an order's "Request a return" action
 * with `?orderId=`. Reached without one (a bookmarked/typed URL), it shows a
 * picker of the orders that can be returned instead of a blank page.
 */
@Component({
  selector: 'account-return-new-page',
  imports: [
    RouterLink,
    MoneyPipe,
    RevealDirective,
    ActionButton,
    CheckboxField,
    EmptyState,
    ImagePlaceholder,
    QuantityStepper,
    SkeletonBlock,
  ],
  template: `
    <section reveal>
      <h1>Request a return</h1>

      @if (loading()) {
        <skeleton-block height="120px" radius="var(--radius-md)" />
      } @else if (loadError()) {
        <empty-state message="We couldn't load that order." icon="triangle-alert">
          <action-button action variant="secondary" size="s" routerLink="/account/orders">
            Back to orders
          </action-button>
        </empty-state>
      } @else if (order(); as o) {
        <p class="subhead">Order #{{ o.orderNumber }} — select the items you'd like to return.</p>

        <ul class="items" role="list">
          @for (item of o.items; track item._id) {
            @if (lineFor(item._id); as line) {
              <li class="item">
                <checkbox-field
                  [checked]="line.selected"
                  (checkedChange)="setSelected(item._id, $event)"
                />
                <image-placeholder [src]="item.imageUrlSnapshot" [alt]="item.nameSnapshot" [width]="56" [height]="56" />
                <div class="item-body">
                  <span class="item-name">{{ item.nameSnapshot }}</span>
                  <span class="item-sku" data-numeric>{{ item.lineTotalMinor | money }}</span>
                  @if (line.selected) {
                    <quantity-stepper
                      [value]="line.quantity"
                      [max]="item.quantity"
                      (valueChange)="setQuantity(item._id, $event)"
                    />
                    <textarea
                      class="reason"
                      placeholder="Why are you returning this?"
                      [value]="line.reason"
                      (input)="setReason(item._id, inputValue($event))"
                    ></textarea>
                  }
                </div>
              </li>
            }
          }
        </ul>

        <action-button size="m" [loading]="submitting()" [disabled]="!hasValidSelection()" (click)="onSubmit()">
          Submit return request
        </action-button>
      } @else if (returnableOrders().length) {
        <p class="subhead">Which order is this about?</p>
        <ul class="orders" role="list">
          @for (o of returnableOrders(); track o.id) {
            <li>
              <a class="order-card" [routerLink]="['/account/returns', 'new']" [queryParams]="{ orderId: o.id }">
                <span class="order-number">Order #{{ o.orderNumber }}</span>
                <span class="order-meta">
                  {{ o.items.length }} {{ o.items.length === 1 ? 'item' : 'items' }} ·
                  <span data-numeric>{{ o.totalMinor | money }}</span>
                </span>
              </a>
            </li>
          }
        </ul>
      } @else {
        <empty-state message="None of your orders are eligible for a return yet." icon="ticket-percent">
          <action-button action variant="secondary" size="s" routerLink="/account/orders">
            View your orders
          </action-button>
        </empty-state>
      }
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    h1 {
      @include type.headline-6;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .subhead {
      @include type.body-2;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-04);
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin: 0 0 var(--space-8);
      padding: 0;
      list-style: none;
      max-width: 32rem;
    }

    .item {
      display: flex;
      align-items: start;
      gap: var(--space-3);
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-neutral-03);

      image-placeholder {
        flex-shrink: 0;
        width: 56px;
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
    }

    .item-body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      flex: 1;
      min-width: 0;
    }

    .item-name {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
    }

    .item-sku {
      @include type.caption-1;
      color: var(--color-neutral-06);
    }

    .reason {
      @include type.body-2;
      min-height: 60px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-border-input);
      resize: vertical;
    }

    .orders {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
      max-width: 32rem;
    }

    .order-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      padding: var(--space-4);
      border: 1px solid var(--color-neutral-03);
      border-radius: var(--radius-md);
      transition: border-color var(--duration-fast) var(--ease-out);
    }

    .order-card:hover {
      border-color: var(--color-neutral-05);
    }

    .order-number {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
    }

    .order-meta {
      @include type.caption-1;
      color: var(--color-neutral-04);
    }
  `,
})
export default class AccountReturnNew implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly returnsService = inject(ReturnsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly orderId = input<string>();

  protected readonly inputValue = inputValue;
  protected readonly order = signal<OrderDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly submitting = signal(false);
  private readonly allOrders = signal<OrderDto[]>([]);
  private readonly lines = signal<Record<string, ReturnLineState>>({});

  protected readonly returnableOrders = computed(() =>
    this.allOrders().filter((o) => RETURNABLE.includes(o.status)),
  );

  ngOnInit(): void {
    const id = this.orderId();
    if (id) {
      this.ordersService.getOrder(id).subscribe({
        next: (order) => {
          this.order.set(order);
          this.lines.set(
            Object.fromEntries(
              order.items.map((item) => [
                item._id,
                { orderItemId: item._id, selected: false, quantity: 1, reason: '' } satisfies ReturnLineState,
              ]),
            ),
          );
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
      return;
    }

    this.ordersService.listMine(1, 50).subscribe({
      next: (page) => {
        this.allOrders.set(page.items);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected lineFor(orderItemId: string): ReturnLineState | undefined {
    return this.lines()[orderItemId];
  }

  // Non-null assertions below: every order line got an entry in
  // ngOnInit before the template that calls these can render at all, so
  // lines[orderItemId] is always present — TS's noUncheckedIndexedAccess
  // just can't see that invariant from the Record<string, T> type alone.

  protected setSelected(orderItemId: string, selected: boolean): void {
    this.lines.update((lines) => ({
      ...lines,
      [orderItemId]: { ...lines[orderItemId]!, selected },
    }));
  }

  protected setQuantity(orderItemId: string, quantity: number): void {
    this.lines.update((lines) => ({
      ...lines,
      [orderItemId]: { ...lines[orderItemId]!, quantity },
    }));
  }

  protected setReason(orderItemId: string, reason: string): void {
    this.lines.update((lines) => ({
      ...lines,
      [orderItemId]: { ...lines[orderItemId]!, reason },
    }));
  }

  protected hasValidSelection(): boolean {
    return Object.values(this.lines()).some((line) => line.selected && line.reason.trim().length > 0);
  }

  protected onSubmit(): void {
    const orderId = this.order()?.id;
    if (!orderId || this.submitting()) return;

    const items = Object.values(this.lines())
      .filter((line) => line.selected && line.reason.trim().length > 0)
      .map((line) => ({ orderItemId: line.orderItemId, quantity: line.quantity, reason: line.reason.trim() }));
    if (items.length === 0) return;

    this.submitting.set(true);
    this.returnsService.request({ orderId, items }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.show('Return request submitted', 'success');
        void this.router.navigateByUrl('/account/returns');
      },
      error: () => this.submitting.set(false),
    });
  }
}
