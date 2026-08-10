import { Component, input, output } from '@angular/core';

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
    <div class="field" [class.has-error]="!!error()">
      <ng-content select="[prefix]" />
      <input
        [id]="id"
        [type]="type()"
        [placeholder]="placeholder()"
        [value]="value()"
        [disabled]="disabled()"
        [attr.aria-invalid]="error() ? 'true' : null"
        [attr.aria-describedby]="describedBy()"
        (input)="onInput($event)"
      />
      <ng-content select="[suffix]" />
    </div>
    @if (error(); as e) {
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
  readonly value = input('');
  readonly hint = input<string>();
  readonly error = input<string>();
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  protected describedBy(): string | null {
    if (this.error()) return this.errorId;
    if (this.hint()) return this.hintId;
    return null;
  }

  protected onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
