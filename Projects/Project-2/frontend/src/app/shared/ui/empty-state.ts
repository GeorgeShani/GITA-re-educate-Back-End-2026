import { Component, input } from '@angular/core';

import { IconGlyph } from './icon-glyph';
import type { IconName } from './icon-sprite';

/**
 * Centered message for a list with no rows (no results, nothing yet) or
 * a failed load. Originally admin-only; promoted here in F12 so the
 * storefront's own "one-line paragraph" empty/error states (shop.ts,
 * blog-list.ts, etc.) get the same real treatment instead of a second
 * copy of this component. The optional `[action]`-slotted content (e.g.
 * a "Clear filters" or "Try again" action-button) is new for that reuse
 * — every existing admin call site renders self-closed with nothing
 * projected, so this is additive, not a behavior change for them.
 */
@Component({
  selector: 'empty-state',
  imports: [IconGlyph],
  template: `
    <icon-glyph [name]="icon()" [size]="32" />
    <p>{{ message() }}</p>
    <ng-content select="[action]" />
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-10) var(--space-4);
      color: var(--color-neutral-04);
    }

    p {
      @include type.body-2;
      margin: 0;
    }
  `,
})
export class EmptyState {
  readonly message = input.required<string>();
  readonly icon = input<IconName>('search');
}
