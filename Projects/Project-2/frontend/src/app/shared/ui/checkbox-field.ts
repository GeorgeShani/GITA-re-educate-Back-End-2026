import { Component, input, output } from '@angular/core';

import { IconGlyph } from './icon-glyph';

/**
 * #fcfcfd is a measured one-off (distinct from --color-neutral-01's
 * #fefefe) — kept as a literal rather than promoted to a token, same
 * treatment _tokens.scss already gives other single-use measurements.
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
          (change)="onChange($event)"
        />
        @if (checked()) {
          <icon-glyph name="check" [size]="16" class="check-icon" />
        }
      </span>
      @if (label(); as l) {
        <span class="label-text">{{ l }}</span>
      }
    </label>
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
  `,
})
export class CheckboxField {
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly label = input<string>();
  readonly checkedChange = output<boolean>();

  protected onChange(event: Event): void {
    this.checkedChange.emit((event.target as HTMLInputElement).checked);
  }
}
