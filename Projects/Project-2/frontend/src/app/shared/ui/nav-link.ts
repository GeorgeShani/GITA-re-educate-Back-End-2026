import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { IconGlyph } from './icon-glyph';

/**
 * Navigation Bar link — Space Grotesk, per the nav-link typography mixin
 * (SCOPE.md A1 correction). Renders a RouterLink when `link` is set,
 * otherwise a plain href — same branch-on-input pattern as action-button.
 */
@Component({
  selector: 'nav-link',
  imports: [RouterLink, RouterLinkActive, IconGlyph],
  template: `
    @if (link(); as l) {
      <a
        class="nav-link"
        [routerLink]="l"
        routerLinkActive="is-active"
        [routerLinkActiveOptions]="{ exact: exact() }"
      >
        <ng-content />
        @if (chevron()) {
          <icon-glyph name="chevron-down" [size]="16" />
        }
      </a>
    } @else {
      <a class="nav-link" [href]="href()">
        <ng-content />
        @if (chevron()) {
          <icon-glyph name="chevron-down" [size]="16" />
        }
      </a>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    .nav-link {
      @include type.nav-link;
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: var(--color-neutral-07);
    }

    .nav-link.is-active {
      color: var(--color-neutral-05);
    }
  `,
})
export class NavLink {
  readonly link = input<string | unknown[]>();
  readonly href = input<string>();
  readonly exact = input(false);
  readonly chevron = input(false);
}
