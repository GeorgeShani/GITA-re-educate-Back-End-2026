import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'price-tag',
  imports: [CurrencyPipe],
  template: `
    <span class="current">{{ price() | currency }}</span>
    @if (originalPrice(); as original) {
      <span class="original">{{ original | currency }}</span>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: inline-flex;
      align-items: baseline;
      gap: var(--space-2);
    }

    .current {
      @include type.caption-1-semi;
      color: var(--color-price);
    }

    .original {
      @include type.caption-1;
      color: var(--color-neutral-04);
      text-decoration: line-through;
    }
  `,
})
export class PriceTag {
  readonly price = input.required<number>();
  readonly originalPrice = input<number>();
}
