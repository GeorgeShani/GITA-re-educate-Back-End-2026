import { Component, input } from '@angular/core';

import { BreadcrumbTrail, type BreadcrumbItem } from './breadcrumb-trail';
import { PageContainer } from './page-container';

/** Thin band wrapping breadcrumb-trail at page width — sits at the top of catalog/PDP pages. */
@Component({
  selector: 'breadcrumb-bar',
  imports: [PageContainer, BreadcrumbTrail],
  template: `
    <div class="breadcrumb-bar">
      <page-container>
        <breadcrumb-trail [items]="items()" />
      </page-container>
    </div>
  `,
  styles: `
    .breadcrumb-bar {
      padding-block: var(--space-4);
      background: var(--color-neutral-01);
    }
  `,
})
export class BreadcrumbBar {
  readonly items = input.required<BreadcrumbItem[]>();
}
