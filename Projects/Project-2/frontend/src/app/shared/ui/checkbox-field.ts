import { Component, computed, input, model, output } from '@angular/core';
import type { ValidationError } from '@angular/forms/signals';

import { checkedValue } from '@/app/core/util/dom-event';
import { IconGlyph } from './icon-glyph';

/**
 * #fcfcfd is a measured one-off (distinct from --color-neutral-01's
 * #fefefe) — kept as a literal rather than promoted to a token, same
 * treatment _tokens.scss already gives other single-use measurements.
 *
 * Implements Signal Forms' FormCheckboxControl contract (`checked` as a
 * model()) — see text-field.ts's class comment for the full rationale.
 * `<checkbox-field [formField]="form.agreeToTerms" label="..." />` wires
 * touched/errors/disabled automatically instead of a manual check.
 */
@Component({
  selector: 'checkbox-field',
  imports: [IconGlyph],
  template: `
    <label class="checkbox-field">
      <span class="box">
        <input
          type="checkbox"
          [checked]="checked()"
          [disabled]="disabled()"
          [attr.aria-invalid]="displayError() ? 'true' : null"
          [attr.aria-describedby]="displayError() ? errorId : null"
          (change)="onChange($event)"
          (blur)="touch.emit()"
        />
        @if (checked()) {
          <icon-glyph name="check" [size]="16" class="check-icon" />
        }
      </span>
      @if (label(); as l) {
        <span class="label-text">{{ l }}</span>
      }
    </label>
    @if (displayError(); as e) {
      <p class="message error" [id]="errorId">{{ e }}</p>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    .checkbox-field {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
    }

    .box {
      position: relative;
      display: inline-flex;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .box input {
      appearance: none;
      width: 100%;
      height: 100%;
      margin: 0;
      border: 1.5px solid var(--color-border-input);
      border-radius: var(--radius-sm);
      background: #fcfcfd;
      cursor: pointer;
      transition:
        background-color var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast) var(--ease-out);
    }

    .box input:checked {
      border-color: var(--color-neutral-07);
      background: var(--color-neutral-07);
    }

    .box input:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .box input:active:not(:disabled) {
      transform: scale(0.97);
      transition: transform var(--duration-instant) var(--ease-in);
    }

    .check-icon {
      /* Explicit size, not just inset: 0, otherwise the icon-glyph host
         (display: inline-flex, no intrinsic size of its own) stretches to
         fill the 24px box and its svg sits at flex-start instead of
         centering — margin: auto only centers a box with a definite size. */
      position: absolute;
      inset: 0;
      width: 16px;
      height: 16px;
      margin: auto;
      color: var(--color-white);
      pointer-events: none;
    }

    .label-text {
      @include type.body-2;
    }

    .message.error {
      @include type.caption-2;
      margin: var(--space-2) 0 0;
      color: var(--color-error);
    }
  `,
})
export class CheckboxField {
  private static nextId = 0;
  protected readonly errorId = `checkbox-field-${CheckboxField.nextId++}-error`;

  readonly disabled = input(false);
  readonly label = input<string>();

  readonly touched = input(false);
  readonly errors = input<readonly ValidationError.WithOptionalFieldTree[]>([]);
  readonly touch = output<void>();

  readonly checked = model(false);

  protected readonly displayError = computed(() => {
    if (!this.touched()) return undefined;
    return this.errors()[0]?.message;
  });

  protected onChange(event: Event): void {
    this.checked.set(checkedValue(event));
  }
}
