import { Component, input } from '@angular/core';

export type StatTileTrend = 'up' | 'down' | 'neutral';

/** One dashboard metric card — label, value, and an optional trend hint. */
@Component({
  selector: 'stat-tile',
  host: {
    '[class.trend-up]': "trend() === 'up'",
    '[class.trend-down]': "trend() === 'down'",
  },
  template: `
    <span class="label">{{ label() }}</span>
    <span class="value" data-numeric>{{ value() }}</span>
    @if (hint(); as h) {
      <span class="hint">{{ h }}</span>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-5);
      border-radius: var(--radius-lg);
      background: var(--color-white);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }

    .label {
      @include type.caption-1;
      color: var(--color-neutral-04);
    }

    .value {
      @include type.headline-5;
      color: var(--color-neutral-07);
    }

    .hint {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    :host.trend-up .hint {
      color: var(--color-success);
    }

    :host.trend-down .hint {
      color: var(--color-error);
    }
  `,
})
export class StatTile {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>();
  readonly trend = input<StatTileTrend>('neutral');
}
