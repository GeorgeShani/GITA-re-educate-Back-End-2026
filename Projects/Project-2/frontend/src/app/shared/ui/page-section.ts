import { Component, input } from '@angular/core';

export type PageSectionSpacing = 'sm' | 'md' | 'lg';

/** Vertical rhythm between major page sections (hero, product carousel, banner, ...). Pair with page-container for the horizontal constraint — they're separate so a full-bleed section can still get page-section's vertical spacing. */
@Component({
  selector: 'page-section',
  host: {
    '[class.spacing-sm]': "spacing() === 'sm'",
    '[class.spacing-md]': "spacing() === 'md'",
    '[class.spacing-lg]': "spacing() === 'lg'",
  },
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
    }

    :host.spacing-sm {
      padding-block: var(--space-8);
    }

    :host.spacing-md {
      padding-block: var(--space-10);
    }

    :host.spacing-lg {
      padding-block: calc(var(--space-10) * 1.5);
    }
  `,
})
export class PageSection {
  readonly spacing = input<PageSectionSpacing>('md');
}
