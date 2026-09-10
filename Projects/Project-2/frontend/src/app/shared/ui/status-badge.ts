import { Component, input } from '@angular/core';

/**
 * `sale`/`new` are the product-card marketing badges; `custom` takes an
 * arbitrary background/colour pair. The five semantic variants
 * (`neutral`/`info`/`success`/`warning`/`danger`) are the shared status
 * language for order/return/review/coupon state — one palette so
 * "delivered" reads the same everywhere instead of every page picking its
 * own colour via `custom`.
 */
export type StatusBadgeVariant =
  | 'sale'
  | 'new'
  | 'custom'
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

@Component({
  selector: 'status-badge',
  host: {
    '[class]': 'variant()',
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

    :host.sale,
    :host.success {
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

    :host.neutral {
      background: var(--color-neutral-03);
      color: var(--color-neutral-05);
    }

    :host.info {
      background: var(--color-info);
      color: var(--color-white);
    }

    :host.warning {
      background: var(--color-warning);
      color: var(--color-neutral-07);
    }

    :host.danger {
      background: var(--color-error);
      color: var(--color-white);
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
