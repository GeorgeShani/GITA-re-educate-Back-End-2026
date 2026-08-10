import { Component, input } from '@angular/core';

/**
 * Reduced-motion is handled globally (_reset.scss neutralises all
 * animation-duration to 0.01ms), so nothing extra needed here — the
 * shimmer just stops moving instead of the block needing its own query.
 */
@Component({
  selector: 'skeleton-block',
  host: {
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.border-radius]': 'radius()',
    '[attr.aria-hidden]': "'true'",
  },
  template: ``,
  styles: `
    :host {
      display: block;
      background: linear-gradient(
        90deg,
        var(--color-neutral-02) 25%,
        var(--color-neutral-03) 37%,
        var(--color-neutral-02) 63%
      );
      background-size: 400% 100%;
      animation: shimmer 1.4s ease infinite;
    }

    @keyframes shimmer {
      0% {
        background-position: 100% 0;
      }
      100% {
        background-position: 0 0;
      }
    }
  `,
})
export class SkeletonBlock {
  readonly width = input('100%');
  readonly height = input('16px');
  readonly radius = input('var(--radius-sm)');
}
