import { Component, ElementRef, Injector, OnInit, afterNextRender, inject, signal, viewChild } from '@angular/core';
import type { Stripe, StripeElements } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';

import { environment } from '@/environments/environment';
import type { SavedPaymentMethodDto } from '@/app/core/api/dto';
import { PaymentMethodsService } from '@/app/core/services/payment-methods.service';
import { ToastService } from '@/app/core/services/toast.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { EmptyState } from '@/app/shared/ui/empty-state';

/**
 * Saved cards via a Stripe SetupIntent — same classic Elements flow as
 * checkout's payment step (clientSecret up front, so elements.submit()
 * isn't needed), except this confirms a SetupIntent (stripe.confirmSetup)
 * to attach a payment method for future use rather than charging anything
 * now. Source: https://docs.stripe.com/js/setup_intents/confirm_setup
 */
@Component({
  selector: 'account-payment-methods-page',
  imports: [RevealDirective, ActionButton, EmptyState],
  template: `
    <section reveal>
      <h1>Payment methods</h1>

      @if (methods(); as list) {
        @if (list.length > 0) {
          <ul class="list" role="list">
            @for (method of list; track method.id) {
              <li class="card">
                <span class="brand">{{ method.brand }} •••• {{ method.last4 }}</span>
                <span class="exp">Expires {{ method.expMonth }}/{{ method.expYear }}</span>
                <button type="button" class="remove" (click)="detach(method.id)">Remove</button>
              </li>
            }
          </ul>
        } @else {
          <empty-state message="No saved cards yet." icon="banknote" />
        }
      }

      @if (!showAddForm()) {
        <action-button size="s" variant="secondary" (click)="startAdd()">Add a card</action-button>
      } @else {
        <div class="add-form">
          @if (mountError(); as err) {
            <p class="error">{{ err }}</p>
          } @else {
            <div #paymentElement class="payment-element"></div>
            @if (confirmError(); as err) {
              <p class="error">{{ err }}</p>
            }
            <div class="add-actions">
              <button type="button" class="cancel" (click)="cancelAdd()">Cancel</button>
              <action-button size="s" [disabled]="!ready() || confirming()" [loading]="confirming()" (click)="onConfirm()">
                Save card
              </action-button>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    h1 {
      @include type.headline-6;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-07);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0 0 var(--space-6);
      padding: 0;
      list-style: none;
      max-width: 28rem;
    }

    .card {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }

    .brand {
      @include type.body-2-semi;
      color: var(--color-neutral-07);
      text-transform: capitalize;
    }

    .exp {
      @include type.caption-1;
      flex: 1;
      color: var(--color-neutral-04);
    }

    .remove {
      @include type.caption-1-semi;
      color: var(--color-error);
      text-decoration: underline;
    }

    .add-form {
      max-width: 28rem;
      margin-top: var(--space-4);
    }

    .payment-element {
      margin-bottom: var(--space-4);
      min-height: 200px;
    }

    .error {
      @include type.caption-1;
      margin: 0 0 var(--space-4);
      color: var(--color-error);
    }

    .add-actions {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .cancel {
      @include type.caption-1-semi;
      color: var(--color-neutral-04);
      text-decoration: underline;
    }
  `,
})
export default class AccountPaymentMethods implements OnInit {
  private readonly paymentMethods = inject(PaymentMethodsService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);

  protected readonly methods = signal<SavedPaymentMethodDto[] | null>(null);
  protected readonly showAddForm = signal(false);
  protected readonly ready = signal(false);
  protected readonly confirming = signal(false);
  protected readonly confirmError = signal<string | null>(null);
  protected readonly mountError = signal<string | null>(null);

  private readonly paymentElementRef = viewChild<ElementRef<HTMLDivElement>>('paymentElement');

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    this.paymentMethods.list().subscribe((methods) => this.methods.set(methods));
  }

  protected startAdd(): void {
    this.showAddForm.set(true);
    this.confirmError.set(null);
    this.mountError.set(null);
    // afterNextRender() needs an injection context; unlike
    // checkout-payment-step.ts (where the whole component is only ever
    // constructed once its clientSecret exists, so the constructor IS
    // that context), this page toggles the form after it's already
    // mounted, so the call site itself isn't one — pass this.injector
    // explicitly instead (confirmed live: omitting it throws NG0203).
    afterNextRender(() => void this.mount(), { injector: this.injector });
  }

  protected cancelAdd(): void {
    this.showAddForm.set(false);
    this.stripe = null;
    this.elements = null;
    this.ready.set(false);
  }

  private async mount(): Promise<void> {
    if (!environment.stripePublishableKey) {
      this.mountError.set('Payment is not configured for this environment.');
      return;
    }

    const [stripe, setupIntent] = await Promise.all([
      loadStripe(environment.stripePublishableKey),
      new Promise<{ clientSecret: string }>((resolve, reject) => {
        this.paymentMethods.createSetupIntent().subscribe({ next: resolve, error: reject });
      }),
    ]);

    if (!stripe) {
      this.mountError.set('Could not load the payment provider. Please try again.');
      return;
    }
    this.stripe = stripe;

    const elements = stripe.elements({ clientSecret: setupIntent.clientSecret });
    this.elements = elements;

    const paymentElement = elements.create('payment');
    const container = this.paymentElementRef()?.nativeElement;
    if (!container) {
      this.mountError.set('Could not load the payment form. Please try again.');
      return;
    }
    paymentElement.mount(container);
    paymentElement.on('ready', () => this.ready.set(true));
  }

  protected async onConfirm(): Promise<void> {
    if (!this.stripe || !this.elements || this.confirming()) return;

    this.confirming.set(true);
    this.confirmError.set(null);

    const { error } = await this.stripe.confirmSetup({
      elements: this.elements,
      confirmParams: { return_url: `${window.location.origin}/account/payment-methods` },
      redirect: 'if_required',
    });

    if (error) {
      this.confirmError.set(error.message ?? 'Could not save this card. Please try again.');
      this.confirming.set(false);
      return;
    }

    this.confirming.set(false);
    this.cancelAdd();
    this.toast.show('Card saved', 'success');
    this.refresh();
  }

  protected detach(paymentMethodId: string): void {
    this.paymentMethods.detach(paymentMethodId).subscribe(() => this.refresh());
  }
}
