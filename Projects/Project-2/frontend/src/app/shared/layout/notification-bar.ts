import { Component, signal } from '@angular/core';

import { IconButton } from '@/app/shared/ui/icon-button';
import { IconGlyph } from '@/app/shared/ui/icon-glyph';

/**
 * Dismissible promo strip above the header. Dismissal is deliberately
 * per-session and in-memory: persisting it would need storage that is
 * unavailable under SSR and blocked in some browsers, for a banner whose
 * whole job is to be seen once.
 */
@Component({
  selector: 'notification-bar',
  imports: [IconGlyph, IconButton],
  template: `
    @if (visible()) {
      <div class="bar">
        <p class="message">
          <icon-glyph name="ticket-percent" [size]="16" />
          <span>30% off storewide &mdash; limited time</span>
        </p>
        <icon-button
          class="dismiss"
          icon="x"
          ariaLabel="Dismiss announcement"
          (clicked)="visible.set(false)"
        />
      </div>
    }
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-4);
      min-height: 36px;
      padding-inline: var(--space-4);
      background: var(--color-neutral-07);
      color: var(--color-neutral-01);

      @include bp.tablet-up {
        min-height: 40px;
      }
    }

    .message {
      @include type.caption-1;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      text-align: center;
    }

    .dismiss {
      position: absolute;
      right: var(--space-4);
    }

    :host {
      display: block;
      position: relative;
    }
  `,
})
export class NotificationBar {
  protected readonly visible = signal(true);
}
