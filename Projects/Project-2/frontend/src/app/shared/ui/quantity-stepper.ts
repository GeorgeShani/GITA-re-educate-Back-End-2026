import { Component, input, output } from '@angular/core';

import { IconGlyph } from './icon-glyph';

@Component({
  selector: 'quantity-stepper',
  imports: [IconGlyph],
  template: `
    <button
      type="button"
      class="step"
      aria-label="Decrease quantity"
      [disabled]="disabled() || value() <= min()"
      (click)="decrement()"
    >
      <icon-glyph name="minus" [size]="16" />
    </button>
    <span class="value" aria-live="polite">{{ value() }}</span>
    <button
      type="button"
      class="step"
      aria-label="Increase quantity"
      [disabled]="disabled() || value() >= max()"
      (click)="increment()"
    >
      <icon-glyph name="plus" [size]="16" />
    </button>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: inline-flex;
      align-items: center;
      justify-content: space-between;
      width: 80px;
      height: 32px;
      padding: 12px 8px;
      border-radius: var(--radius-sm);
      box-shadow: inset 0 0 0 1px var(--color-border-input);
    }

    .step {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: 0;
      color: inherit;
      transition: opacity var(--duration-fast) var(--ease-out);
    }

    .step:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .value {
      @include type.caption-1-semi;
      min-width: 1.5em;
      text-align: center;
    }
  `,
})
export class QuantityStepper {
  readonly value = input(1);
  readonly min = input(1);
  readonly max = input(99);
  readonly step = input(1);
  readonly disabled = input(false);
  readonly valueChange = output<number>();

  protected increment(): void {
    this.valueChange.emit(Math.min(this.value() + this.step(), this.max()));
  }

  protected decrement(): void {
    this.valueChange.emit(Math.max(this.value() - this.step(), this.min()));
  }
}
