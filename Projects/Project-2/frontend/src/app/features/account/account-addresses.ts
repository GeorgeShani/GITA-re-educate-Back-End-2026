import { Component, OnInit, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';

import type { AddressDto, AddressInput } from '@/app/core/api/dto';
import { COUNTRY_OPTIONS } from '@/app/core/constants/countries';
import { AccountService } from '@/app/core/services/account.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { SelectField } from '@/app/shared/ui/select-field';
import { TextField } from '@/app/shared/ui/text-field';

/**
 * Signal Forms' [formField] binds to a plain-text <input> only where the
 * field's type is exactly `string`, not `string | undefined` — AddressInput's
 * optional fields (line2/region/phone) don't qualify, so the form model
 * keeps them as always-`string` (empty means "unset") and toAddressInput()
 * converts at the API boundary instead.
 */
interface AddressFormModel {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  phone: string;
  isDefault: boolean;
}

function blankAddress(): AddressFormModel {
  return {
    fullName: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    postalCode: '',
    countryCode: 'US',
    phone: '',
    isDefault: false,
  };
}

function toFormModel(address: AddressDto): AddressFormModel {
  return {
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    region: address.region ?? '',
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    phone: address.phone ?? '',
    isDefault: address.isDefault ?? false,
  };
}

/** Omits optional fields left blank rather than sending them as empty strings. */
function toAddressInput(model: AddressFormModel): AddressInput {
  return {
    fullName: model.fullName,
    line1: model.line1,
    line2: model.line2 || undefined,
    city: model.city,
    region: model.region || undefined,
    postalCode: model.postalCode,
    countryCode: model.countryCode,
    phone: model.phone || undefined,
    isDefault: model.isDefault,
  };
}

/** Address book CRUD — GET/POST/PATCH/DELETE /users/me/addresses. */
@Component({
  selector: 'account-addresses-page',
  imports: [FormField, RevealDirective, ActionButton, CheckboxField, TextField, SelectField],
  template: `
    <section reveal>
      <div class="head">
        <h1>Addresses</h1>
        @if (!showForm()) {
          <action-button size="s" variant="secondary" (click)="startAdd()">Add address</action-button>
        }
      </div>

      @if (showForm()) {
        <form class="address-form" (submit)="onSubmit($event)" novalidate>
          <text-field label="Full name" [height]="48" autocomplete="name" [formField]="addressForm.fullName" />
          <text-field
            label="Address line 1"
            [height]="48"
            autocomplete="address-line1"
            [formField]="addressForm.line1"
          />
          <text-field
            label="Address line 2 (optional)"
            [height]="48"
            autocomplete="address-line2"
            [formField]="addressForm.line2"
          />
          <div class="field-row">
            <text-field
              label="City"
              [height]="48"
              autocomplete="address-level2"
              [formField]="addressForm.city"
            />
            <text-field
              label="Postal code"
              [height]="48"
              autocomplete="postal-code"
              [formField]="addressForm.postalCode"
            />
          </div>
          <div class="field-row">
            <text-field
              label="Region / state (optional)"
              [height]="48"
              autocomplete="address-level1"
              [formField]="addressForm.region"
            />
            <select-field
              label="Country"
              [options]="countryOptions"
              [value]="model().countryCode"
              (valueChange)="model.update((m) => ({ ...m, countryCode: $event }))"
            />
          </div>
          <text-field
            label="Phone (optional)"
            type="tel"
            [height]="48"
            autocomplete="tel"
            [formField]="addressForm.phone"
          />
          <label class="default-check">
            <checkbox-field
              [checked]="model().isDefault"
              (checkedChange)="model.update((m) => ({ ...m, isDefault: $event }))"
            />
            Make this my default address
          </label>

          <div class="form-actions">
            <button type="button" class="cancel" (click)="cancelForm()">Cancel</button>
            <action-button type="submit" size="m" [loading]="saving()">
              {{ editingId() ? 'Save changes' : 'Add address' }}
            </action-button>
          </div>
        </form>
      }

      @if (addresses(); as list) {
        @if (list.length === 0 && !showForm()) {
          <p class="empty">You have no saved addresses yet.</p>
        } @else {
          <ul class="list" role="list">
            @for (address of list; track address.id) {
              <li class="card">
                <div class="card-body">
                  <strong>{{ address.fullName }}</strong>
                  @if (address.isDefault) {
                    <span class="badge">Default</span>
                  }
                  <p>
                    {{ address.line1 }}{{ address.line2 ? ', ' + address.line2 : '' }}<br />
                    {{ address.city }}, {{ address.postalCode }}<br />
                    {{ address.countryCode }}
                  </p>
                </div>
                <div class="card-actions">
                  <button type="button" (click)="startEdit(address)">Edit</button>
                  <button type="button" class="remove" (click)="remove(address.id)">Remove</button>
                </div>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-6);
    }

    h1 {
      @include type.headline-6;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .address-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 30rem;
      margin-bottom: var(--space-8);
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-neutral-02);
    }

    .field-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-4);

      // Was an unconditional 1fr 1fr.
      @include bp.tablet-up {
        grid-template-columns: 1fr 1fr;
      }
    }

    .default-check {
      @include type.body-2;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-neutral-06);
    }

    .form-actions {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

    .cancel {
      @include type.caption-1-semi;
      color: var(--color-neutral-04);
      text-decoration: underline;
    }

    .empty {
      @include type.body-2;
      color: var(--color-neutral-04);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .card {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-5);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }

    .card-body {
      strong {
        @include type.body-2-semi;
        color: var(--color-neutral-07);
      }

      p {
        @include type.caption-1;
        margin: var(--space-1) 0 0;
        color: var(--color-neutral-06);
      }
    }

    .badge {
      @include type.hairline-1;
      margin-left: var(--space-2);
      padding: 2px 8px;
      border-radius: var(--radius-sm);
      background: var(--color-success);
      color: var(--color-neutral-07);
      text-transform: uppercase;
    }

    .card-actions {
      display: flex;
      flex-direction: column;
      align-items: end;
      gap: var(--space-2);
      flex-shrink: 0;

      button {
        @include type.caption-1-semi;
        color: var(--color-neutral-06);
        text-decoration: underline;
      }

      .remove {
        color: var(--color-error);
      }
    }
  `,
})
export default class AccountAddresses implements OnInit {
  private readonly account = inject(AccountService);

  protected readonly addresses = signal<AddressDto[] | null>(null);
  protected readonly showForm = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly model = signal<AddressFormModel>(blankAddress());
  protected readonly countryOptions = COUNTRY_OPTIONS;

  protected readonly addressForm = form(this.model, (f) => {
    required(f.fullName, { message: 'Full name is required' });
    required(f.line1, { message: 'Address is required' });
    required(f.city, { message: 'City is required' });
    required(f.postalCode, { message: 'Postal code is required' });
  });

  ngOnInit(): void {
    this.account.listAddresses().subscribe((addresses) => this.addresses.set(addresses));
  }

  protected startAdd(): void {
    this.editingId.set(null);
    this.model.set(blankAddress());
    this.showForm.set(true);
  }

  protected startEdit(address: AddressDto): void {
    this.editingId.set(address.id);
    this.model.set(toFormModel(address));
    this.showForm.set(true);
  }

  protected cancelForm(): void {
    this.showForm.set(false);
  }

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.addressForm().markAsTouched();
    if (!this.addressForm().valid() || this.saving()) return;

    this.saving.set(true);
    const id = this.editingId();
    const input = toAddressInput(this.model());
    const request = id ? this.account.updateAddress(id, input) : this.account.addAddress(input);

    request.subscribe({
      next: (addresses) => {
        this.addresses.set(addresses);
        this.saving.set(false);
        this.showForm.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(addressId: string): void {
    this.account.removeAddress(addressId).subscribe((addresses) => this.addresses.set(addresses));
  }
}
