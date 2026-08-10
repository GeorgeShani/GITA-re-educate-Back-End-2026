import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconGlyph } from './icon-glyph';

export interface BreadcrumbItem {
  readonly label: string;
  readonly link?: string | unknown[];
}

@Component({
  selector: 'breadcrumb-trail',
  imports: [RouterLink, IconGlyph],
  template: `
    <nav aria-label="Breadcrumb">
      <ol class="breadcrumb-trail">
        @for (item of items(); track item.label; let isLast = $last) {
          <li class="breadcrumb-trail__item">
            @if (!isLast && item.link) {
              <a [routerLink]="item.link">{{ item.label }}</a>
              <icon-glyph name="chevron-right" [size]="14" class="breadcrumb-trail__sep" />
            } @else {
              <span aria-current="page">{{ item.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    @use 'styles/typography' as type;

    .breadcrumb-trail {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .breadcrumb-trail__item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .breadcrumb-trail a {
      @include type.caption-1;
      color: var(--color-neutral-04);
    }

    .breadcrumb-trail a:hover {
      color: var(--color-neutral-07);
    }

    .breadcrumb-trail [aria-current='page'] {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
    }

    .breadcrumb-trail__sep {
      color: var(--color-neutral-03);
    }
  `,
})
export class BreadcrumbTrail {
  readonly items = input.required<BreadcrumbItem[]>();
}
