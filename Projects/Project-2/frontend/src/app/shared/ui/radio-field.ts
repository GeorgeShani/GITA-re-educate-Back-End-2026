import { Component, input, output } from '@angular/core';

/** Same measured chrome as checkbox-field: 24x24, 1.5px border, #fcfcfd fill. */
@Component({
  selector: 'radio-field',
  template: `
    <label class="radio-field">
      <span class="circle">
        <input
          type="radio"
          [name]="name()"
          [value]="value()"
          [checked]="checked()"
          [disabled]="disabled()"
          (change)="onChange()"
        />
      </span>
      @if (label(); as l) {
        <span class="label-text">{{ l }}</span>
      }
    </label>
  `,
  styles: `
    @use 'styles/typography' as type;

    .radio-field {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      cursor: pointer;
    }

    .circle {
      display: inline-flex;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .circle input {
      appearance: none;
      width: 100%;
      height: 100%;
      margin: 0;
      border: 1.5px solid var(--color-border-input);
      border-radius: var(--radius-full);
      background: #fcfcfd;
      cursor: pointer;
      transition:
        border-color var(--duration-fast) var(--ease-out),
        box-shadow var(--duration-fast) var(--ease-out);
    }

    .circle input:checked {
      border-color: var(--color-neutral-07);
      box-shadow: inset 0 0 0 6px var(--color-neutral-07);
    }

    .circle input:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .label-text {
      @include type.body-2;
    }
  `,
})
export class RadioField {
  readonly name = input.required<string>();
  readonly value = input.required<string>();
  readonly checked = input(false);
  readonly disabled = input(false);
  readonly label = input<string>();
  readonly selected = output<string>();

  protected onChange(): void {
    this.selected.emit(this.value());
  }
}
