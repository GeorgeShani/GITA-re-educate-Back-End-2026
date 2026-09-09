import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import type { AddressInput, CheckoutQuoteDto, OrderDto } from '@/app/core/api/dto';
import { AuthService } from '@/app/core/services/auth.service';
import { CartService } from '@/app/core/services/cart.service';
import { CheckoutService } from '@/app/core/services/checkout.service';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { CheckoutAddressStep } from './checkout-address-step';
import { CheckoutPaymentStep } from './checkout-payment-step';
import { CheckoutShippingStep } from './checkout-shipping-step';

type Step = 'address' | 'shipping' | 'payment';

const STEP_LABELS: Record<Step, string> = {
  address: 'Address',
  shipping: 'Shipping',
  payment: 'Payment',
};
const STEP_ORDER: Step[] = ['address', 'shipping', 'payment'];

/**
 * The stepper shell: owns the state that carries across steps (chosen
 * addresses, the live quote, the placed order + its PaymentIntent secret)
 * and swaps in one step component at a time. Each step component is
 * otherwise dumb — it only knows the slice of state it needs and emits
 * forward/back events, never talks to a service directly except the two
 * exceptions noted on each step.
 */
@Component({
  selector: 'checkout-page',
  imports: [
    RevealDirective,
    MoneyPipe,
    ImagePlaceholder,
    PageContainer,
    PageSection,
    CheckoutAddressStep,
    CheckoutShippingStep,
    CheckoutPaymentStep,
  ],
  template: `
    <page-section spacing="md">
      <page-container>
        <h1 reveal>Checkout</h1>

        <ol class="stepper" reveal aria-label="Checkout steps">
          @for (s of stepOrder; track s) {
            <li [class.active]="s === step()" [class.done]="isDone(s)">
              {{ stepLabels[s] }}
            </li>
          }
        </ol>

        <div class="layout">
          <div class="main" reveal>
            @switch (step()) {
              @case ('address') {
                <checkout-address-step
                  [savedAddresses]="auth.currentUser()?.addresses ?? []"
                  (continue)="onAddressContinue($event)"
                />
              }
              @case ('shipping') {
                @if (quote(); as q) {
                  <checkout-shipping-step
                    [quote]="q"
                    (continue)="onShippingContinue($event)"
                    (back)="step.set('address')"
                  />
                }
              }
              @case ('payment') {
                @if (clientSecret(); as secret) {
                  <checkout-payment-step
                    [clientSecret]="secret"
                    [orderId]="order()!.id"
                    (paid)="onPaid()"
                  />
                }
              }
            }
          </div>

          <aside class="summary" reveal>
            <h2>Order summary</h2>
            <ul class="items" role="list">
              @for (item of cart.items(); track item.itemId) {
                <li class="item">
                  <image-placeholder [src]="item.imageUrl" [alt]="item.productName" [width]="56" [height]="56" />
                  <div class="item-body">
                    <span class="item-name">{{ item.productName }}</span>
                    <span class="item-qty">Qty {{ item.quantity }}</span>
                  </div>
                  <span class="item-price" data-numeric>{{ item.lineTotalMinor | money }}</span>
                </li>
              }
            </ul>
            <div class="subtotal-row">
              <span>Subtotal</span>
              <span data-numeric>{{ cart.subtotalMinor() | money }}</span>
            </div>
          </aside>
        </div>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-07);
    }

    .stepper {
      @include type.caption-1-semi;
      display: flex;
      gap: var(--space-6);
      margin: 0 0 var(--space-8);
      padding: 0;
      list-style: none;
      color: var(--color-neutral-04);
    }

    .stepper li.done {
      color: var(--color-neutral-06);
    }

    .stepper li.active {
      color: var(--color-neutral-07);
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-8);

      @include bp.wide-up {
        grid-template-columns: 2fr 1fr;
        align-items: start;
      }
    }

    .summary {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-neutral-02);
    }

    .summary h2 {
      @include type.body-1-semi;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .items {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .item {
      display: flex;
      align-items: center;
      gap: var(--space-3);

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
      flex: 1;
      min-width: 0;
    }

    .item-name {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
    }

    .item-qty {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    .item-price {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
      white-space: nowrap;
    }

    .subtotal-row {
      @include type.body-1-semi;
      display: flex;
      justify-content: space-between;
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-neutral-03);
      color: var(--color-neutral-07);
    }
  `,
})
export default class Checkout implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  private readonly checkoutService = inject(CheckoutService);
  private readonly router = inject(Router);

  protected readonly stepOrder = STEP_ORDER;
  protected readonly stepLabels = STEP_LABELS;
  protected readonly step = signal<Step>('address');

  protected readonly quote = signal<CheckoutQuoteDto | null>(null);
  protected readonly order = signal<OrderDto | null>(null);
  protected readonly clientSecret = signal<string | null>(null);

  private shippingAddress: AddressInput | null = null;
  private billingAddress: AddressInput | null = null;

  constructor() {
    // Nothing to check out — send them back rather than showing an empty
    // stepper. No guest checkout either, but authGuard already handles that
    // at the route level.
    //
    // This has to be reactive, not a one-time ngOnInit check: app.ts's
    // cart.load() only fires once at bootstrap, and on a hard navigation
    // straight to /checkout (typed URL, refresh, bookmark) this component
    // mounts before that load resolves — cart.cart() is still `null` then,
    // and isEmpty() reads that as "empty" (0 items), bouncing a customer
    // with a real cart straight back to /cart. Waiting for cart() to
    // actually settle (non-null) before judging emptiness fixes that.
    //
    // Must stop once an order exists, though: onPaid() below refreshes the
    // cart (now legitimately empty — the order converted it) and THEN
    // navigates to the complete page. Without the order() check this same
    // effect fires on that same signal change and races its own
    // navigateByUrl('/cart') against onPaid()'s navigateByUrl('/checkout/
    // complete/...') — confirmed live: the two navigations aborted each
    // other's router view-transition and left the page stuck on
    // "Processing…" forever.
    effect(() => {
      const summary = this.cart.cart();
      if (summary !== null && summary.items.length === 0 && this.order() === null) {
        void this.router.navigateByUrl('/cart');
      }
    });
  }

  ngOnInit(): void {
    // authGuard only checks token presence — the user's saved addresses
    // (UserDto.addresses) aren't loaded until something calls /auth/me.
    this.auth.loadCurrentUser().subscribe();
  }

  protected isDone(s: Step): boolean {
    return this.stepOrder.indexOf(s) < this.stepOrder.indexOf(this.step());
  }

  protected onAddressContinue(addresses: { shipping: AddressInput; billing: AddressInput }): void {
    this.shippingAddress = addresses.shipping;
    this.billingAddress = addresses.billing;

    this.checkoutService.getQuote(addresses.shipping.countryCode, addresses.shipping.region).subscribe({
      next: (quote) => {
        this.quote.set(quote);
        this.step.set('shipping');
      },
    });
  }

  protected onShippingContinue(method: string): void {
    if (!this.shippingAddress || !this.billingAddress) return;

    this.checkoutService
      .placeOrder({
        shippingAddress: this.shippingAddress,
        billingAddress: this.billingAddress,
        shippingMethod: method,
      })
      .subscribe({
        next: ({ order, clientSecret }) => {
          this.order.set(order);
          this.clientSecret.set(clientSecret);
          this.step.set('payment');
        },
      });
  }

  protected onPaid(): void {
    const placedOrder = this.order();
    if (!placedOrder) return;

    // The cart converts server-side the moment the order is placed — refresh
    // so the header badge/cart page reflect the now-empty cart.
    this.cart.refresh().subscribe();

    // A hard location change, not just a bare fallback for a `false`
    // result: the customer has already been charged at this point, so
    // getting stuck on the payment step is the single worst outcome in
    // this whole flow — confirmed live that withViewTransitions() can
    // abort this specific in-app navigation (application-wide, not
    // something this page opted into) and leave the router never
    // committing the URL change, silently. navigateByUrl's own promise
    // resolves `false` on that outcome, so this is a real, reachable path,
    // not defensive-for-its-own-sake.
    this.router.navigateByUrl(`/checkout/complete/${placedOrder.id}`).then((succeeded) => {
      if (!succeeded) window.location.href = `/checkout/complete/${placedOrder.id}`;
    });
  }
}
