import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '@/app/core/services/auth.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';

interface AccountNavItem {
  path: string;
  label: string;
}

const NAV_ITEMS: AccountNavItem[] = [
  { path: 'profile', label: 'Profile' },
  { path: 'addresses', label: 'Addresses' },
  { path: 'orders', label: 'Orders' },
  { path: 'wishlist', label: 'Wishlist' },
  { path: 'returns', label: 'Returns' },
  { path: 'payment-methods', label: 'Payment methods' },
  { path: 'settings', label: 'Settings' },
];

/**
 * Parent shell for every /account/* route — a sidebar nav plus a
 * <router-outlet> for the active section. Each section is its own lazy
 * child route (see app.routes.ts) rather than one giant component, same
 * reasoning as F3's home page: keeps each file well under the 4kB
 * per-component style budget and lets each section load independently.
 */
@Component({
  selector: 'account-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, RevealDirective, PageContainer, PageSection],
  template: `
    <page-section spacing="md">
      <page-container>
        <div class="layout">
          <nav class="sidebar" reveal aria-label="Account">
            <p class="greeting">Hi, {{ auth.currentUser()?.firstName ?? 'there' }}</p>
            <ul role="list">
              @for (item of navItems; track item.path) {
                <li>
                  <a [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
                </li>
              }
            </ul>
            <button type="button" class="sign-out" (click)="signOut()">Sign out</button>
          </nav>

          <div class="content" reveal>
            <router-outlet />
          </div>
        </div>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-8);

      @include bp.wide-up {
        grid-template-columns: 240px 1fr;
        align-items: start;
      }
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-neutral-02);
    }

    .greeting {
      @include type.body-1-semi;
      margin: 0;
      color: var(--color-neutral-07);
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    a {
      @include type.body-2;
      display: block;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      color: var(--color-neutral-06);

      &:hover {
        background: var(--color-neutral-03);
      }

      // Solid inverted pill for the selected item — the same active
      // treatment the shop and blog filter lists use, so "this is
      // selected" reads the same across every left-hand nav.
      &.active {
        @include type.body-2-semi;
        background: var(--color-neutral-07);
        color: var(--color-neutral-01);
      }

      &.active:hover {
        background: var(--color-neutral-07);
      }
    }

    .sign-out {
      @include type.caption-1-semi;
      align-self: start;
      margin-top: var(--space-2);
      padding: var(--space-2) var(--space-3);
      color: var(--color-neutral-04);
      text-decoration: underline;
    }

    .content {
      min-width: 0;
    }
  `,
})
export default class AccountShell implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navItems = NAV_ITEMS;

  ngOnInit(): void {
    // The greeting reads auth.currentUser(), which nothing populates on a
    // fresh page load until something calls /auth/me — authGuard only
    // checks token presence. Owning that load here (rather than leaving
    // it to whichever child page happens to call it, e.g. the profile
    // page) means every section under /account gets a real greeting, not
    // just the ones whose own page happens to fetch the user.
    this.auth.loadCurrentUser().subscribe();
  }

  protected signOut(): void {
    this.auth.logout().subscribe({
      complete: () => void this.router.navigateByUrl('/'),
      error: () => void this.router.navigateByUrl('/'),
    });
  }
}
