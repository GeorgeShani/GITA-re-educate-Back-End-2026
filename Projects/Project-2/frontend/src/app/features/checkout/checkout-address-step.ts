import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';

import type { AddressDto, AddressInput } from '@/app/core/api/dto';
import { COUNTRY_OPTIONS } from '@/app/core/constants/countries';
import { ToastService } from '@/app/core/services/toast.service';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { RadioField } from '@/app/shared/ui/radio-field';
import { SelectField } from '@/app/shared/ui/select-field';
import { TextField } from '@/app/shared/ui/text-field';

function blankAddress(): AddressInput {
  return {
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    countryCode: 'US',
    phone: '',
  };
}

/**
 * Step 1 of checkout. Picks a shipping address (from the user's saved book,
 * or types a new one) and a billing address (defaults to "same as
 * shipping" — the common case — with its own form only when unchecked).
 */
@Component({
  selector: 'checkout-address-step',
  imports: [NgTemplateOutlet, FormField, RadioField, CheckboxField, TextField, SelectField],
  template: `
    <section class="step">
      <h2>Shipping address</h2>

      @if (savedAddresses().length > 0) {
        <ul class="saved-list" role="list">
          @for (address of savedAddresses(); track address._id) {
            <li>
              <label class="saved-option">
                <radio-field
                  name="shipping-address"
                  [value]="address._id"
                  [checked]="selectedShippingId() === address._id"
                  (selected)="selectedShippingId.set($event)"
                />
                <span class="saved-text">
                  <strong>{{ address.fullName }}</strong>
                  {{ address.line1 }}{{ address.line2 ? ', ' + address.line2 : '' }},
                  {{ address.city }} {{ address.postalCode }}, {{ address.countryCode }}
                </span>
              </label>
            </li>
          }
          <li>
            <label class="saved-option">
              <radio-field
                name="shipping-address"
                value="new"
                [checked]="selectedShippingId() === 'new'"
                (selected)="selectedShippingId.set('new')"
              />
              <span class="saved-text">Use a new address</span>
            </label>
          </li>
        </ul>
      }

      @if (selectedShippingId() === 'new') {
        <div class="fields">
          <ng-container
            [ngTemplateOutlet]="addressFields"
            [ngTemplateOutletContext]="{ f: shippingForm, m: shippingModel }"
          />
        </div>
      }

      <label class="same-as-shipping">
        <checkbox-field
          [checked]="billingSameAsShipping()"
          (checkedChange)="billingSameAsShipping.set($event)"
        />
        Billing address is the same as shipping
      </label>

      @if (!billingSameAsShipping()) {
        <h2>Billing address</h2>
        <div class="fields">
          <ng-container
            [ngTemplateOutlet]="addressFields"
            [ngTemplateOutletContext]="{ f: billingForm, m: billingModel }"
          />
        </div>
      }

      <ng-template #addressFields let-f="f" let-m="m">
        <text-field label="Full name" [height]="48" autocomplete="name" [formField]="f.fullName" />
        <text-field
          label="Address line 1"
          [height]="48"
          autocomplete="address-line1"
          [formField]="f.line1"
        />
        <text-field
          label="Address line 2 (optional)"
          [height]="48"
          autocomplete="address-line2"
          [formField]="f.line2"
        />
        <div class="field-row">
          <text-field
            label="City"
            [height]="48"
            autocomplete="address-level2"
            [formField]="f.city"
          />
          <text-field
            label="Postal code"
            [height]="48"
            autocomplete="postal-code"
            [formField]="f.postalCode"
          />
        </div>
        <div class="field-row">
          <text-field
            label="Region / state (optional)"
            [height]="48"
            autocomplete="address-level1"
            [formField]="f.region"
          />
          <select-field
            label="Country"
            [options]="countryOptions"
            [value]="m().countryCode"
            (valueChange)="setCountry(m, $event)"
          />
        </div>
        <text-field label="Phone (optional)" [height]="48" type="tel" autocomplete="tel" [formField]="f.phone" />
      </ng-template>

      <button type="button" class="continue" [disabled]="submitting()" (click)="onContinue()">
        {{ submitting() ? 'Loading shipping options…' : 'Continue to shipping' }}
      </button>
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    h2 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);

      &:not(:first-child) {
        margin-top: var(--space-8);
      }
    }

    .saved-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin: 0 0 var(--space-6);
      padding: 0;
      list-style: none;
    }

    .saved-option {
      display: flex;
      align-items: start;
      gap: var(--space-3);
      padding: var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      cursor: pointer;
    }

    .saved-text {
      @include type.body-2;
      color: var(--color-neutral-06);

      strong {
        display: block;
        color: var(--color-neutral-07);
      }
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    .field-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-4);

      // Was an unconditional 1fr 1fr — this step is the highest-stakes
      // form in the app and the most likely to be filled out on a phone;
      // two address fields squeezed side by side broke down well before
      // mobile width.
      @include bp.tablet-up {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .same-as-shipping {
      @include type.body-2;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: var(--space-2) 0 0;
      color: var(--color-neutral-06);
    }

    .continue {
      @include type.body-2-semi;
      margin-top: var(--space-8);
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
export class CheckoutAddressStep {
  private readonly toast = inject(ToastService);

  readonly savedAddresses = input<AddressDto[]>([]);
  readonly submitting = input(false);
  readonly continue = output<{ shipping: AddressInput; billing: AddressInput }>();

  protected readonly countryOptions = COUNTRY_OPTIONS;

  protected readonly selectedShippingId = signal<string>('new');

  protected readonly shippingModel = signal<AddressInput>(blankAddress());
  protected readonly billingModel = signal<AddressInput>(blankAddress());
  protected readonly billingSameAsShipping = signal(true);

  protected readonly shippingForm = form(this.shippingModel, (f) => {
    required(f.fullName, { message: 'Full name is required' });
    required(f.line1, { message: 'Address is required' });
    required(f.city, { message: 'City is required' });
    required(f.postalCode, { message: 'Postal code is required' });
  });

  protected readonly billingForm = form(this.billingModel, (f) => {
    required(f.fullName, { message: 'Full name is required' });
    required(f.line1, { message: 'Address is required' });
    required(f.city, { message: 'City is required' });
    required(f.postalCode, { message: 'Postal code is required' });
  });

  private readonly defaultAddressId = computed(
    () => this.savedAddresses().find((a) => a.isDefault)?._id ?? this.savedAddresses()[0]?._id,
  );

  private autoSelectedAddress = false;

  constructor() {
    // Pre-select the default saved address once one arrives. savedAddresses
    // is fed by an async GET /auth/me and is empty on first render, so this
    // has to be an effect: the one-shot read it replaced always saw an empty
    // list, and a returning customer landed on "Use a new address" instead
    // of their own saved one. Runs once, so it never overrides a choice the
    // customer has already made.
    effect(() => {
      const defaultId = this.defaultAddressId();
      if (!defaultId || this.autoSelectedAddress) return;
      this.autoSelectedAddress = true;
      untracked(() => this.selectedShippingId.set(defaultId));
    });
  }

  protected setCountry(model: typeof this.shippingModel, countryCode: string): void {
    model.update((m) => ({ ...m, countryCode }));
  }

  protected onContinue(): void {
    let shipping: AddressInput;

    if (this.selectedShippingId() === 'new') {
      this.shippingForm().markAsTouched();
      if (!this.shippingForm().valid()) return;
      shipping = this.shippingModel();
    } else {
      const saved = this.savedAddresses().find((a) => a._id === this.selectedShippingId());
      if (!saved) {
        this.toast.show('Select a shipping address to continue', 'error');
        return;
      }
      // Strip the subdocument id: the backend's ValidationPipe runs with
      // forbidNonWhitelisted, so an `_id` left in the address body is a 400.
      const { _id, ...rest } = saved;
      shipping = rest;
    }

    let billing: AddressInput;
    if (this.billingSameAsShipping()) {
      billing = shipping;
    } else {
      this.billingForm().markAsTouched();
      if (!this.billingForm().valid()) return;
      billing = this.billingModel();
    }

    this.continue.emit({ shipping, billing });
  }
}
