import { Component, ElementRef, computed, input, model, output, viewChild } from '@angular/core';
import type { ValidationError } from '@angular/forms/signals';

import { inputValue } from '@/app/core/util/dom-event';

/**
 * Same chrome as text-field, fixed at the measured h140, and the same
 * FormValueControl contract — see text-field.ts's class comment.
 */
@Component({
  selector: 'textarea-field',
  template: `
    @if (label(); as l) {
      <label [for]="id">{{ l }}</label>
    }
    <textarea
      #textareaEl
      [id]="id"
      [placeholder]="placeholder()"
      [value]="value()"
      [disabled]="disabled()"
      [attr.aria-invalid]="displayError() ? 'true' : null"
      [attr.aria-describedby]="describedBy()"
      (input)="onInput($event)"
      (blur)="touch.emit()"
    ></textarea>
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
  readonly hint = input<string>();
  readonly disabled = input(false);

  readonly touched = input(false);
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly touch = output<void>();

  readonly value = model('');

  private readonly textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

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

  focus(options?: FocusOptions): void {
    this.textareaEl()?.nativeElement.focus(options);
  }
}
