import { Component, input, output } from '@angular/core';

/** Same chrome as text-field, fixed at the measured h140. */
@Component({
  selector: 'textarea-field',
  template: `
    @if (label(); as l) {
      <label [for]="id">{{ l }}</label>
    }
    <textarea
      [id]="id"
      [placeholder]="placeholder()"
      [value]="value()"
      [disabled]="disabled()"
      [attr.aria-invalid]="error() ? 'true' : null"
      [attr.aria-describedby]="describedBy()"
      (input)="onInput($event)"
    ></textarea>
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

    textarea {
      @include type.body-2;
      display: block;
      width: 100%;
      height: 140px;
      padding: var(--space-4) 16px;
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-border-input);
      outline: none;
      resize: vertical;
      color: var(--color-neutral-07);
      transition: box-shadow var(--duration-fast) var(--ease-out);
    }

    textarea:focus {
      box-shadow: inset 0 0 0 1px var(--color-info);
    }

    textarea::placeholder {
      color: var(--color-neutral-04);
    }

    textarea:disabled {
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
export class TextareaField {
  private static nextId = 0;
  protected readonly id = `textarea-field-${TextareaField.nextId++}`;
  protected readonly hintId = `${this.id}-hint`;
  protected readonly errorId = `${this.id}-error`;

  readonly label = input<string>();
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
    this.valueChange.emit((event.target as HTMLTextAreaElement).value);
  }
}
