import { Component, OnInit, computed, input, output, signal } from '@angular/core';

import type { CheckoutQuoteDto } from '@/app/core/api/dto';
import { MoneyPipe } from '@/app/shared/pipes/money.pipe';
import { RadioField } from '@/app/shared/ui/radio-field';

/**
 * Step 2. Picks a shipping method off a live GET /checkout/quote — the
 * quote already prices tax and any coupon discount into each option's
 * totalMinor, so this step can show a real payable total per choice
 * instead of a bare shipping price.
 */
@Component({
  selector: 'checkout-shipping-step',
  imports: [MoneyPipe, RadioField],
  template: `
    <section class="step">
      <h2>Shipping method</h2>

      <ul class="options" role="list">
        @for (option of quote().shippingOptions; track option.method) {
          <li>
            <label class="option">
              <span class="option-main">
                <radio-field
                  name="shipping-method"
                  [value]="option.method"
                  [checked]="selected() === option.method"
                  (selected)="selected.set($event)"
                />
                <span class="option-text">
                  <strong>{{ option.method }}</strong>
                  @if (option.estimatedDaysMin !== undefined) {
                    <span class="eta">
                      {{ option.estimatedDaysMin }}–{{ option.estimatedDaysMax }} business days
                    </span>
                  }
                </span>
              </span>
              <span class="option-price" data-numeric>
                {{ option.effectivePriceMinor | money }}
              </span>
            </label>
          </li>
        }
      </ul>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span data-numeric>{{ quote().subtotalMinor | money }}</span>
        </div>
        @if (quote().discountMinor > 0) {
          <div class="totals-row">
            <span>Discount</span>
            <span data-numeric>-{{ quote().discountMinor | money }}</span>
          </div>
        }
        <div class="totals-row">
          <span>Tax</span>
          <span data-numeric>{{ quote().taxMinor | money }}</span>
        </div>
        @if (selectedOption(); as opt) {
          <div class="totals-row totals-final">
            <span>Total</span>
            <span data-numeric>{{ opt.totalMinor | money }}</span>
          </div>
        }
      </div>

      <div class="actions">
        <button type="button" class="back" [disabled]="submitting()" (click)="back.emit()">
          Back
        </button>
        <button
          type="button"
          class="continue"
          [disabled]="!selected() || submitting()"
          (click)="onContinue()"
        >
          {{ submitting() ? 'Placing order…' : 'Continue to payment' }}
        </button>
      </div>
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    h2 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0 0 var(--space-6);
      padding: 0;
      list-style: none;
    }

    .option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      cursor: pointer;
    }

    .option-main {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .option-text {
      @include type.body-2;
      display: flex;
      flex-direction: column;
      color: var(--color-neutral-07);
      text-transform: capitalize;
    }

    .eta {
      @include type.caption-2;
      color: var(--color-neutral-04);
      text-transform: none;
    }

    .option-price {
      @include type.body-2-semi;
      color: var(--color-price);
      white-space: nowrap;
    }

    .totals {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding-block: var(--space-4);
      border-block: 1px solid var(--color-neutral-03);
    }

    .totals-row {
      @include type.body-2;
      display: flex;
      justify-content: space-between;
      color: var(--color-neutral-06);
    }

    .totals-final {
      @include type.body-1-semi;
      color: var(--color-neutral-07);
    }

    .actions {
      display: flex;
      gap: var(--space-3);
      margin-top: var(--space-8);
    }

    .back {
      @include type.body-2-semi;
      padding: var(--space-4) var(--space-6);
      border-radius: var(--radius-full);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      color: var(--color-neutral-07);
    }

    .continue {
      @include type.body-2-semi;
      flex: 1;
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
export class CheckoutShippingStep implements OnInit {
  readonly quote = input.required<CheckoutQuoteDto>();
  readonly submitting = input(false);
  readonly continue = output<string>();
  readonly back = output<void>();

  protected readonly selected = signal<string | null>(null);

  protected readonly selectedOption = computed(() =>
    this.quote().shippingOptions.find((o) => o.method === this.selected()),
  );

  ngOnInit(): void {
    // Default to the first (cheapest — the backend returns them in rate
    // order) option rather than forcing an empty choice on a step that
    // usually has a shortlist of 2-3 methods. Required inputs aren't
    // guaranteed set until after the constructor runs, so this can't live
    // there (NG8118) — ngOnInit is the first hook where reading it is safe.
    const first = this.quote().shippingOptions[0];
    if (first) this.selected.set(first.method);
  }

  protected onContinue(): void {
    const method = this.selected();
    if (method) this.continue.emit(method);
  }
}
