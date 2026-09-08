import { Component, input } from '@angular/core';

import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import type { IconName } from '@/app/shared/ui/icon-sprite';

/** Centered message for a list with no rows (no results, nothing yet). */
@Component({
  selector: 'empty-state',
  imports: [IconGlyph],
  template: `
    <icon-glyph [name]="icon()" [size]="32" />
    <p>{{ message() }}</p>
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
