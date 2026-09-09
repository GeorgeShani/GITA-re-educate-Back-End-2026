import { Component, computed, ElementRef, input, model, output, viewChild } from '@angular/core';
import type { ValidationError } from '@angular/forms/signals';

import { inputValue } from '@/app/core/util/dom-event';

export type TextFieldType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'search';
export type TextFieldHeight = 40 | 48 | 52;

/**
 * label/hint/error are linked to the input via id — a static per-class
 * counter, not crypto/random, so the value is deterministic and never
 * causes an SSR/client mismatch warning. (The counter itself does reset
 * per client load vs. persist across server requests, but text-field's
 * real usages — account/auth/checkout — are all RenderMode.Client per
 * app.routes.server.ts, so there's no SSR pass for this id to mismatch
 * against in practice.)
 *
 * Implements Signal Forms' FormValueControl contract (`value` as a
 * model(), plus the touched/errors/disabled inputs and touch output the
 * `[formField]` directive knows to wire up automatically) so a form can
 * bind straight to it — `<text-field [formField]="form.email" label="Email" />`
 * — instead of hand-wiring [value]/(valueChange) and a manual touched/
 * errors check for every field on every page. [value]/(valueChange) still
 * work exactly as before for non-form callers (admin pages, cart's coupon
 * field): a model() is a plain input+output pair under the hood, so
 * nothing about that existing usage changes.
 * Source: https://angular.dev/guide/forms/signals/custom-controls
 */
@Component({
  selector: 'text-field',
  host: {
    '[style.--field-height.px]': 'height()',
  },
  template: `
    @if (label(); as l) {
      <label [for]="id">{{ l }}</label>
    }
    <div class="field" [class.has-error]="!!displayError()">
      <ng-content select="[prefix]" />
      <input
        #inputEl
        [id]="id"
        [type]="type()"
        [placeholder]="placeholder()"
        [value]="value()"
        [disabled]="disabled()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="displayError() ? 'true' : null"
        [attr.aria-describedby]="describedBy()"
        (input)="onInput($event)"
        (blur)="touch.emit()"
      />
      <ng-content select="[suffix]" />
    </div>
    @if (displayError(); as e) {
      <p class="message error" [id]="errorId">{{ e }}</p>
    } @else if (hint(); as h) {
      <p class="message hint" [id]="hintId">{{ h }}</p>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    label {
      @include type.caption-1-semi;
      display: block;
      margin-bottom: var(--space-2);
    }

    .field {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      height: var(--field-height, 40px);
      padding: 0 16px;
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-border-input);
      transition: box-shadow var(--duration-fast) var(--ease-out);
    }

    .field:focus-within {
      box-shadow: inset 0 0 0 1px var(--color-info);
    }

    .field.has-error {
      box-shadow: inset 0 0 0 1px var(--color-error);
    }

    input {
      @include type.body-2;
      flex: 1;
      min-width: 0;
      border: none;
      background: none;
      outline: none;
      color: var(--color-neutral-07);
    }

    input::placeholder {
      color: var(--color-neutral-04);
    }

    input:disabled {
      color: var(--color-neutral-04);
      cursor: not-allowed;
    }

    .message {
      @include type.caption-2;
      margin-top: var(--space-2);
      color: var(--color-neutral-04);
    }

    .message.error {
      color: var(--color-error);
    }
  `,
})
export class TextField {
  private static nextId = 0;
  protected readonly id = `text-field-${TextField.nextId++}`;
  protected readonly hintId = `${this.id}-hint`;
  protected readonly errorId = `${this.id}-error`;

  readonly label = input<string>();
  readonly type = input<TextFieldType>('text');
  readonly height = input<TextFieldHeight>(40);
  readonly placeholder = input('');
  readonly autocomplete = input<string>();
  readonly hint = input<string>();
  readonly disabled = input(false);

  // FormValueControl contract (see class comment): `[formField]` sets
  // these three straight from the bound field, same as it would for a
  // native <input>. Kept as plain input()s, not model()s — the directive
  // only ever writes them, and a stray two-way binding from a template
  // author would fight the field's own state.
  readonly touched = input(false);
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly touch = output<void>();

  // The one genuinely two-way piece — required by FormValueControl.
  readonly value = model('');

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  // Same touched-gated display a hand-written template would do
  // (`@if (field().touched() && field().errors()[0])`) — centralised here
  // so every consumer gets it for free instead of repeating the check.
  protected readonly displayError = computed(() => {
    if (!this.touched()) return undefined;
    return this.errors()[0]?.message;
  });

  protected describedBy(): string | null {
    if (this.displayError()) return this.errorId;
    if (this.hint()) return this.hintId;
    return null;
  }

  protected onInput(event: Event): void {
    this.value.set(inputValue(event));
  }

  /** FormValueControl's optional hook — without it, Signal Forms would
   * try to focus the <text-field> host itself (not focusable) instead of
   * the real input, e.g. when jumping to the first invalid field on a
   * failed submit. */
  focus(options?: FocusOptions): void {
    this.inputEl()?.nativeElement.focus(options);
  }
}
