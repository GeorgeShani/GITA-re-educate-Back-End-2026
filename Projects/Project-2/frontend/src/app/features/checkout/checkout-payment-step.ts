import { Component, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import type { Stripe, StripeElements, StripePaymentElement } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';

import { environment } from '@/environments/environment';

/**
 * Step 3, the last one. The Order and its PaymentIntent already exist by
 * the time this mounts (checkout.service.ts's placeOrder created both in
 * one call) — this step's only job is collecting payment details against
 * the clientSecret it was handed and confirming.
 *
 * Classic (non-deferred) Elements flow: clientSecret is passed to
 * stripe.elements() up front, so elements.submit() is NOT required before
 * confirmPayment() — that call is only for the deferred
 * create-the-intent-on-submit flow.
 * Source: https://docs.stripe.com/js/elements/submit
 *
 * redirect: 'if_required' keeps the "no hosted checkout and no redirect"
 * plan requirement for card payments; return_url still has to be a real,
 * absolute URL because a handful of payment methods (e.g. bank redirects)
 * redirect there regardless.
 * Source: https://docs.stripe.com/js/payment_intents/confirm_payment
 */
@Component({
  selector: 'checkout-payment-step',
  template: `
    <section class="step">
      <h2>Payment</h2>

      @if (mountError(); as err) {
        <p class="error">{{ err }}</p>
      } @else {
        <div #paymentElement class="payment-element"></div>

        @if (confirmError(); as err) {
          <p class="error">{{ err }}</p>
        }

        <button
          type="button"
          class="pay"
          [disabled]="!ready() || confirming()"
          (click)="onPay()"
        >
          {{ confirming() ? 'Processing…' : 'Pay now' }}
        </button>
      }
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    h2 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);
    }

    .payment-element {
      margin-bottom: var(--space-6);
      min-height: 200px;
    }

    .error {
      @include type.caption-1;
      margin: 0 0 var(--space-4);
      color: var(--color-error);
    }

    .pay {
      @include type.body-2-semi;
      width: 100%;
      padding: var(--space-4) var(--space-8);
      border-radius: var(--radius-full);
      background: var(--color-neutral-07);
      color: var(--color-white);

      &:disabled {
        opacity: 0.5;
      }
    }
  `,
})
export class CheckoutPaymentStep {
  readonly clientSecret = input.required<string>();
  readonly orderId = input.required<string>();
  readonly paid = output<void>();

  private readonly paymentElementRef = viewChild<ElementRef<HTMLDivElement>>('paymentElement');

  protected readonly ready = signal(false);
  protected readonly confirming = signal(false);
  protected readonly confirmError = signal<string | null>(null);
  protected readonly mountError = signal<string | null>(null);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private paymentElement: StripePaymentElement | null = null;

  constructor() {
    // Stripe Elements needs a live DOM node — mounting only after the first
    // real render, same reasoning select-field.ts uses afterNextRender for
    // its CDK overlay.
    afterNextRender(() => void this.mount());
  }

  private async mount(): Promise<void> {
    if (!environment.stripePublishableKey) {
      this.mountError.set('Payment is not configured for this environment.');
      return;
    }

    const stripe = await loadStripe(environment.stripePublishableKey);
    if (!stripe) {
      this.mountError.set('Could not load the payment provider. Please try again.');
      return;
    }
    this.stripe = stripe;

    const elements = stripe.elements({ clientSecret: this.clientSecret() });
    this.elements = elements;

    const paymentElement = elements.create('payment');
    const container = this.paymentElementRef()?.nativeElement;
    if (!container) {
      this.mountError.set('Could not load the payment form. Please try again.');
      return;
    }
    paymentElement.mount(container);
    paymentElement.on('ready', () => this.ready.set(true));
    this.paymentElement = paymentElement;
  }

  protected async onPay(): Promise<void> {
    if (!this.stripe || !this.elements || this.confirming()) return;

    this.confirming.set(true);
    this.confirmError.set(null);

    const { error } = await this.stripe.confirmPayment({
      elements: this.elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/complete/${this.orderId()}`,
      },
      redirect: 'if_required',
    });

    if (error) {
      this.confirmError.set(error.message ?? 'Payment failed. Please try again.');
      this.confirming.set(false);
      return;
    }

    // No `error` and no redirect happened (redirect: 'if_required') means
    // the PaymentIntent already resolved — reaching here IS the success
    // case per stripe.confirmPayment's own contract.
    this.paid.emit();
  }
}
