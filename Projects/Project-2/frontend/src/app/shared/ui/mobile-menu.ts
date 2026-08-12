import { Component, input, output } from '@angular/core';

import { DrawerPanel } from './drawer-panel';
import { NavLink } from './nav-link';
import type { NavItem } from './site-header';

/** Thin wrapper around drawer-panel — reuses its overlay/focus-trap/escape/backdrop handling rather than reimplementing any of it. */
@Component({
  selector: 'mobile-menu',
  imports: [DrawerPanel, NavLink],
  template: `
    <drawer-panel [open]="open()" (openChange)="openChange.emit($event)" side="left">
      <nav class="mobile-menu__nav" aria-label="Main">
        @for (item of navItems(); track item.label) {
          <nav-link [link]="item.link" (click)="openChange.emit(false)">{{ item.label }}</nav-link>
        }
      </nav>
    </drawer-panel>
  `,
  styles: `
    .mobile-menu__nav {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      margin-top: var(--space-6);
    }
  `,
})
export class MobileMenu {
  readonly open = input(false);
  readonly navItems = input<NavItem[]>([]);
  readonly openChange = output<boolean>();
}
