import { Component, input, output } from '@angular/core';

import { ActionButton } from './action-button';
import { DrawerPanel } from './drawer-panel';
import { IconButton } from './icon-button';
import { ImagePlaceholder } from './image-placeholder';
import { PriceTag } from './price-tag';
import { QuantityStepper } from './quantity-stepper';

export interface CartLineItem {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly price: number;
  readonly quantity: number;
}

/**
 * Presentational only — no cart state/service dependency. Real cart state
 * (add/remove/persist) is Phase F3 (signal stores) work; this just
 * renders whatever line items it's given and emits intent, so F3 can
 * wire a real CartService in later without this component's shape
 * needing to change.
 */
@Component({
  selector: 'cart-drawer',
  imports: [DrawerPanel, ImagePlaceholder, PriceTag, QuantityStepper, IconButton, ActionButton],
  template: `
    <drawer-panel [open]="open()" (openChange)="openChange.emit($event)" side="right">
      <div class="cart-drawer">
        <h2 class="cart-drawer__title">Your Cart</h2>
        @if (items().length === 0) {
          <p class="cart-drawer__empty">Your cart is empty.</p>
        } @else {
          <ul class="cart-drawer__list" role="list">
            @for (item of items(); track item.id) {
              <li class="cart-drawer__item">
                <image-placeholder [src]="item.image" [alt]="item.name" [width]="72" [height]="72" />
                <div class="cart-drawer__item-details">
                  <p class="cart-drawer__item-name">{{ item.name }}</p>
                  <price-tag [price]="item.price" />
                  <quantity-stepper
                    [value]="item.quantity"
                    (valueChange)="quantityChange.emit({ id: item.id, quantity: $event })"
                  />
                </div>
                <icon-button icon="close" ariaLabel="Remove {{ item.name }}" (clicked)="remove.emit(item.id)" />
              </li>
            }
          </ul>
          <div class="cart-drawer__footer">
            <div class="cart-drawer__subtotal">
              <span>Subtotal</span>
              <price-tag [price]="subtotal()" />
            </div>
            <action-button [fullWidth]="true" (click)="checkout.emit()">Checkout</action-button>
          </div>
        }
      </div>
    </drawer-panel>
  `,
  styles: `
    @use 'styles/typography' as type;

    // drawer-panel's own .drawer-panel__body (flex: 1, the thing that
    // actually grows to fill the drawer's height) is out of reach from
    // here — it's drawn from drawer-panel's own encapsulated template,
    // not this component's. Wrapping our own content in a flex column
    // that fills 100% of that grown space is what makes
    // .cart-drawer__footer's margin-top: auto push to the bottom.
    .cart-drawer {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .cart-drawer__title {
      @include type.headline-6;
      margin-bottom: var(--space-6);
    }

    .cart-drawer__empty {
      @include type.body-2;
      color: var(--color-neutral-04);
    }

    .cart-drawer__list {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .cart-drawer__item {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
    }

    .cart-drawer__item-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .cart-drawer__item-name {
      @include type.caption-1-semi;
    }

    .cart-drawer__footer {
      margin-top: auto;
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-neutral-03);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .cart-drawer__subtotal {
      @include type.body-2-semi;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  `,
})
export class CartDrawer {
  readonly open = input(false);
  readonly items = input<CartLineItem[]>([]);
  readonly subtotal = input(0);
  readonly openChange = output<boolean>();
  readonly quantityChange = output<{ id: string; quantity: number }>();
  readonly remove = output<string>();
  readonly checkout = output<void>();
}
