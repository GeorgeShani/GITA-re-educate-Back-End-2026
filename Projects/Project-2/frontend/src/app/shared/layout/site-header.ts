import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CartService } from '@/app/core/services/cart.service';
import { TokenStore } from '@/app/core/services/token-store';
import { DrawerPanel } from '@/app/shared/ui/drawer-panel';
import { IconButton } from '@/app/shared/ui/icon-button';
import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { NavLink } from '@/app/shared/ui/nav-link';
import { PageContainer } from '@/app/shared/ui/page-container';

interface NavItem {
  readonly label: string;
  readonly link: string;
}

const NAV: readonly NavItem[] = [
  { label: 'Home', link: '/' },
  { label: 'Shop', link: '/shop' },
  { label: 'Journal', link: '/blog' },
  { label: 'Contact', link: '/contact' },
];

/**
 * The primary site header: wordmark, primary nav, and the account/cart
 * actions. Below the tablet breakpoint the nav collapses into a drawer
 * rather than a custom dropdown, so focus trapping and escape-to-close come
 * from the existing drawer primitive instead of being re-implemented.
 */
@Component({
  selector: 'site-header',
  imports: [RouterLink, PageContainer, NavLink, IconGlyph, IconButton, DrawerPanel],
  template: `
    <page-container>
      <div class="bar">
        <div class="left">
          <icon-button
            class="burger"
            icon="menu"
            ariaLabel="Open menu"
            (clicked)="menuOpen.set(true)"
          />
          <a class="wordmark" routerLink="/">3legant<span>.</span></a>
        </div>

        <nav class="nav" aria-label="Primary">
          @for (item of nav; track item.link) {
            <nav-link [link]="item.link" [exact]="item.link === '/'">
              {{ item.label }}
            </nav-link>
          }
        </nav>

        <div class="actions">
          <a class="action" routerLink="/search" aria-label="Search">
            <icon-glyph name="search" [size]="20" />
          </a>
          <a
            class="action"
            [routerLink]="isAuthenticated() ? '/account' : '/sign-in'"
            [attr.aria-label]="isAuthenticated() ? 'Your account' : 'Sign in'"
          >
            <icon-glyph name="circle-user" [size]="20" />
          </a>
          <a class="action cart" routerLink="/cart" [attr.aria-label]="cartLabel()">
            <icon-glyph name="shopping-bag" [size]="20" />
            @if (itemCount() > 0) {
              <span class="count" aria-hidden="true">{{ itemCount() }}</span>
            }
          </a>
        </div>
      </div>
    </page-container>

    <drawer-panel side="left" [open]="menuOpen()" (openChange)="menuOpen.set($event)">
      <nav class="drawer-nav" aria-label="Primary">
        @for (item of nav; track item.link) {
          <a [routerLink]="item.link" (click)="menuOpen.set(false)">{{ item.label }}</a>
        }
      </nav>
    </drawer-panel>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: var(--z-sticky);
      background: var(--color-neutral-01);
      border-bottom: 1px solid var(--color-neutral-03);
    }

    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      min-height: 60px;
    }

    .left {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .wordmark {
      @include type.headline-7;
      color: var(--color-neutral-07);
      letter-spacing: -0.03em;

      span {
        color: var(--color-success);
      }
    }

    .nav {
      display: none;
      gap: var(--space-8);

      @include bp.tablet-up {
        display: flex;
      }
    }

    .burger {
      @include bp.tablet-up {
        display: none;
      }
    }

    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }

    .action {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-full);
      color: var(--color-neutral-07);

      &:hover {
        background: var(--color-neutral-02);
      }
    }

    .cart {
      position: relative;
    }

    .count {
      @include type.caption-2-semi;
      position: absolute;
      top: 2px;
      right: 0;
      display: grid;
      place-items: center;
      min-width: 18px;
      height: 18px;
      padding-inline: 4px;
      border-radius: var(--radius-full);
      background: var(--color-neutral-07);
      color: var(--color-neutral-01);
    }

    .drawer-nav {
      display: grid;
      gap: var(--space-2);
      padding-top: var(--space-6);

      a {
        @include type.headline-7;
        padding-block: var(--space-3);
        color: var(--color-neutral-07);
      }
    }
  `,
})
export class SiteHeader {
  private readonly cart = inject(CartService);
  private readonly tokens = inject(TokenStore);

  protected readonly nav = NAV;
  protected readonly menuOpen = signal(false);
  protected readonly itemCount = this.cart.itemCount;
  protected readonly isAuthenticated = this.tokens.isAuthenticated;

  protected readonly cartLabel = computed(() => {
    const count = this.itemCount();
    return count === 0 ? 'Cart, empty' : `Cart, ${count} item${count === 1 ? '' : 's'}`;
  });
}
