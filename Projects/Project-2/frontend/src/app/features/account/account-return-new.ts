import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { OrderDto } from '@/app/core/api/dto';
import { OrdersService } from '@/app/core/services/orders.service';
import { ReturnsService } from '@/app/core/services/returns.service';
import { ToastService } from '@/app/core/services/toast.service';
import { inputValue } from '@/app/core/util/dom-event';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { QuantityStepper } from '@/app/shared/ui/quantity-stepper';

interface ReturnLineState {
  orderItemId: string;
  selected: boolean;
  quantity: number;
  reason: string;
}

/** POST /returns. Reached from an order's "Request a return" action with ?orderId=. */
@Component({
  selector: 'account-return-new-page',
  imports: [MoneyPipe, RevealDirective, ActionButton, CheckboxField, ImagePlaceholder, QuantityStepper],
  template: `
    <section reveal>
      <h1>Request a return</h1>

      @if (order(); as o) {
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
  `,
})
export default class AccountReturnNew implements OnInit {
  private readonly ordersService = inject(OrdersService);
  private readonly returnsService = inject(ReturnsService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly orderId = input.required<string>();

  protected readonly inputValue = inputValue;
  protected readonly order = signal<OrderDto | null>(null);
  protected readonly submitting = signal(false);
  private readonly lines = signal<Record<string, ReturnLineState>>({});

  ngOnInit(): void {
    this.ordersService.getOrder(this.orderId()).subscribe((order) => {
      this.order.set(order);
      this.lines.set(
        Object.fromEntries(
          order.items.map((item) => [
            item._id,
            { orderItemId: item._id, selected: false, quantity: 1, reason: '' } satisfies ReturnLineState,
          ]),
        ),
      );
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
