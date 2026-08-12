import { Component, afterNextRender, input, signal } from '@angular/core';

import { IconButton } from './icon-button';

/**
 * Dismissible top announcement bar, persisted via localStorage. Renders
 * visible by default (SSR can't know the stored dismissal state) and
 * hides itself post-hydration if previously dismissed — same
 * progressive-enhancement-first bias as the reveal directive, applied to
 * a different problem: a brief flash-then-hide is the honest tradeoff
 * for SSR + client-only persisted state, not a bug to hide.
 */
@Component({
  selector: 'notification-bar',
  imports: [IconButton],
  template: `
    @if (!dismissed()) {
      <div class="notification-bar">
        <p class="notification-bar__text"><ng-content /></p>
        <icon-button
          icon="close"
          ariaLabel="Dismiss"
          class="notification-bar__close"
          (clicked)="dismiss()"
        />
      </div>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    .notification-bar {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      block-size: 40px;
      background: var(--color-neutral-07);
      color: var(--color-white);
    }

    .notification-bar__text {
      @include type.caption-1;
      margin: 0;
    }

    .notification-bar__close {
      position: absolute;
      inset-inline-end: var(--space-4);
      color: inherit;
    }
  `,
})
export class NotificationBar {
  readonly storageKey = input('notification-bar-dismissed');

  protected readonly dismissed = signal(false);

  constructor() {
    afterNextRender(() => {
      if (typeof localStorage === 'undefined') return;
      this.dismissed.set(localStorage.getItem(this.storageKey()) === 'true');
    });
  }

  protected dismiss(): void {
    this.dismissed.set(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey(), 'true');
    }
  }
}
