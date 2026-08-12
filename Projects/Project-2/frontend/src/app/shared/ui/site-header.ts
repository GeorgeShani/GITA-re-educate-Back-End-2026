import { Component, DestroyRef, afterNextRender, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconButton } from './icon-button';
import { IconGlyph } from './icon-glyph';
import { NavLink } from './nav-link';
import { PageContainer } from './page-container';

export interface NavItem {
  readonly label: string;
  readonly link: string | unknown[];
}

/**
 * 1440x60 desktop / 375x60 mobile per the measured Figma facts. `transparent`
 * is for a homepage-style header sitting over a hero image — it only stays
 * transparent above the fold; scrolling always forces the opaque/white
 * treatment so nav stays readable once the hero is gone. Sticking itself is
 * plain CSS (position: sticky); the scroll listener only toggles a class
 * for that visual swap, not the sticking behavior.
 */
@Component({
  selector: 'site-header',
  imports: [RouterLink, NavLink, IconGlyph, IconButton, PageContainer],
  host: {
    '[class.is-scrolled]': 'scrolled()',
    '[class.is-transparent]': 'transparent() && !scrolled()',
  },
  template: `
    <page-container class="site-header__inner">
      <button
        type="button"
        class="site-header__menu-toggle"
        aria-label="Open menu"
        (click)="menuToggle.emit()"
      >
        <icon-glyph name="menu" [size]="24" />
      </button>

      <a routerLink="/" class="site-header__logo">3legant</a>

      <nav class="site-header__nav" aria-label="Main">
        @for (item of navItems(); track item.label) {
          <nav-link [link]="item.link">{{ item.label }}</nav-link>
        }
      </nav>

      <div class="site-header__actions">
        <icon-button icon="search" ariaLabel="Search" class="site-header__search" />
        <icon-button icon="user" ariaLabel="Account" class="site-header__account" />
        <button type="button" class="site-header__cart" aria-label="Cart" (click)="cartToggle.emit()">
          <icon-glyph name="cart" [size]="24" />
          @if (cartCount() > 0) {
            <span class="site-header__cart-count">{{ cartCount() }}</span>
          }
        </button>
      </div>
    </page-container>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    :host {
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      display: block;
      background: var(--color-white);
      transition: background-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
    }

    :host.is-scrolled {
      box-shadow: var(--shadow-01);
    }

    :host.is-transparent {
      background: transparent;
      box-shadow: none;
    }

    .site-header__inner {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      block-size: 60px;
    }

    .site-header__menu-toggle {
      display: inline-flex;
      background: none;
      border: none;
      padding: 0;
      color: inherit;

      @include bp.tablet-up {
        display: none;
      }
    }

    .site-header__logo {
      @include type.headline-7;
      font-family: var(--font-poppins);
      font-weight: 500;
      color: var(--color-neutral-07);
    }

    .site-header__nav {
      display: none;
      align-items: center;
      gap: 40px;
      margin-inline-start: var(--space-8);

      @include bp.tablet-up {
        display: flex;
      }
    }

    .site-header__actions {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-inline-start: auto;
    }

    .site-header__search,
    .site-header__account {
      display: none;

      @include bp.tablet-up {
        display: inline-flex;
      }
    }

    .site-header__cart {
      position: relative;
      display: inline-flex;
      align-items: center;
      background: none;
      border: none;
      padding: var(--space-1);
      color: inherit;
    }

    .site-header__cart-count {
      @include type.caption-2-semi;
      position: absolute;
      inset-block-start: -4px;
      inset-inline-end: -6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding-inline: 4px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-07);
      color: var(--color-white);
    }
  `,
})
export class SiteHeader {
  readonly navItems = input<NavItem[]>([]);
  readonly transparent = input(false);
  readonly cartCount = input(0);
  readonly menuToggle = output<void>();
  readonly cartToggle = output<void>();

  protected readonly scrolled = signal(false);

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const onScroll = () => this.scrolled.set(window.scrollY > 8);
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      this.destroyRef.onDestroy(() => window.removeEventListener('scroll', onScroll));
    });
  }
}
