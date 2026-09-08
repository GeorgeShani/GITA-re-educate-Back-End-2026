import { Component, input } from '@angular/core';

/** Title + action-slot header used at the top of every admin page. */
@Component({
  selector: 'page-toolbar',
  template: `
    <div class="head">
      <h1>{{ title() }}</h1>
      @if (subtitle(); as s) {
        <p class="subtitle">{{ s }}</p>
      }
    </div>
    <div class="actions">
      <ng-content />
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-6);
    }

    h1 {
      @include type.headline-6;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .subtitle {
      @include type.caption-1;
      margin: var(--space-1) 0 0;
      color: var(--color-neutral-04);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
  `,
})
export class PageToolbar {
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
