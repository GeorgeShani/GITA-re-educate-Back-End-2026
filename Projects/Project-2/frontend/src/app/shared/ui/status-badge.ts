import { Component, input } from '@angular/core';

export type StatusBadgeVariant = 'sale' | 'new' | 'custom';

@Component({
  selector: 'status-badge',
  host: {
    '[class.sale]': "variant() === 'sale'",
    '[class.new]': "variant() === 'new'",
    '[style.background]': "variant() === 'custom' ? background() : null",
    '[style.color]': "variant() === 'custom' ? color() : null",
  },
  template: `<ng-content />`,
  styles: `
    @use 'styles/typography' as type;

    :host {
      @include type.hairline-1;
      display: inline-block;
      padding: 4px 14px;
      border-radius: var(--radius-sm);
      text-transform: uppercase;
      white-space: nowrap;
    }

    :host.sale {
      background: var(--color-success);
      // The design pairs white with this green, but that measures 2.09:1 —
      // well under the AA floor AGENTS.md makes mandatory. Dark text on the
      // same green keeps the badge recognisable at 8.64:1.
      color: var(--color-neutral-07);
    }

    :host.new {
      background: var(--color-white);
      color: var(--color-neutral-07);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
    }
  `,
})
export class StatusBadge {
  readonly variant = input<StatusBadgeVariant>('sale');
  /** Only read when variant is 'custom'. */
  readonly background = input<string>();
  /** Only read when variant is 'custom'. */
  readonly color = input<string>();
}
