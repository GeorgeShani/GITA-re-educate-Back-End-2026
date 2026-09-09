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
    <div class="collapse" [class.is-dismissed]="dismissed()">
      <div class="collapse-inner">
        <div class="bar">
          <p class="message">
            <icon-glyph name="ticket-percent" [size]="16" />
            <span>30% off storewide &mdash; limited time</span>
          </p>
          <icon-button
            class="dismiss"
            icon="x"
            ariaLabel="Dismiss announcement"
            (clicked)="dismissed.set(true)"
          />
        </div>
      </div>
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    // Same 0fr -> 1fr grid-height technique as accordion-panel.ts, in
    // reverse (starts expanded, collapses on dismiss) — a plain @if
    // removal here was an instant DOM removal that jolted the sticky
    // header sitting right below it. visibility carries the asymmetric
    // delay so the dismissed bar leaves the a11y tree (and stops being
    // tab-reachable) only once it's fully collapsed.
    .collapse {
      display: grid;
      grid-template-rows: 1fr;
      visibility: visible;
      transition:
        grid-template-rows var(--duration-base) var(--ease-out),
        visibility 0s;
    }

    .collapse.is-dismissed {
      grid-template-rows: 0fr;
      visibility: hidden;
      transition:
        grid-template-rows var(--duration-base) var(--ease-out),
        visibility 0s var(--duration-base);
    }

    .collapse-inner {
      overflow: hidden;
      min-height: 0;
    }

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
      // Own snapshot group for the route cross-fade
      // (styles/_view-transitions.scss) so this holds still across a real
      // route change instead of fading with the rest of the page.
      view-transition-name: notification-bar;
    }
  `,
})
export class NotificationBar {
  protected readonly dismissed = signal(false);
}
