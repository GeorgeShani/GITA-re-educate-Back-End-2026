import { Component, OnInit, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import type { RoleDto } from '@/app/core/api/dto';
import { ADMIN_ROLES } from '@/app/core/constants/admin-roles';
import { AuthService } from '@/app/core/services/auth.service';
import { TokenStore } from '@/app/core/services/token-store';

interface AdminNavItem {
  path: string;
  label: string;
  roles: readonly RoleDto[];
}

const NAV_ITEMS: AdminNavItem[] = [
  { path: 'dashboard', label: 'Dashboard', roles: ['admin'] },
  { path: 'products', label: 'Products', roles: ADMIN_ROLES.catalog },
  { path: 'categories', label: 'Categories', roles: ADMIN_ROLES.catalog },
  { path: 'inventory', label: 'Inventory', roles: ADMIN_ROLES.catalog },
  { path: 'media', label: 'Media library', roles: ADMIN_ROLES.catalog },
  { path: 'orders', label: 'Orders', roles: ADMIN_ROLES.commerce },
  { path: 'returns', label: 'Returns', roles: ADMIN_ROLES.commerce },
  { path: 'reviews', label: 'Reviews', roles: ADMIN_ROLES.commerce },
  { path: 'coupons', label: 'Coupons', roles: ADMIN_ROLES.money },
  { path: 'gift-cards', label: 'Gift cards', roles: ADMIN_ROLES.money },
  { path: 'shipping', label: 'Shipping zones', roles: ADMIN_ROLES.money },
  { path: 'tax', label: 'Tax rates', roles: ADMIN_ROLES.money },
  { path: 'blog', label: 'Blog', roles: ADMIN_ROLES.content },
  { path: 'pages', label: 'Pages', roles: ADMIN_ROLES.content },
  { path: 'contact', label: 'Contact inbox', roles: ADMIN_ROLES.content },
  { path: 'newsletter', label: 'Newsletter', roles: ADMIN_ROLES.content },
  { path: 'emails', label: 'Email log', roles: ADMIN_ROLES.content },
  { path: 'users', label: 'Users & roles', roles: ADMIN_ROLES.people },
  { path: 'audit-log', label: 'Audit log', roles: ['admin'] },
];

/**
 * Parent shell for every /admin/* route — same "sidebar + router-outlet"
 * shape as account-shell.ts, but nav items are filtered by the caller's
 * role (mirrors backend/src/common/constants/admin-roles.constant.ts):
 * showing a link the API would 403 on is worse than not showing it.
 */
@Component({
  selector: 'admin-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <div class="layout">
      <nav class="sidebar" aria-label="Admin">
        <a routerLink="/" class="wordmark">3legant<span>.</span> Admin</a>
        <p class="role">Signed in as {{ auth.currentUser()?.firstName }} · {{ role() }}</p>
        <ul role="list">
          @for (item of visibleNavItems(); track item.path) {
            <li>
              <a [routerLink]="item.path" routerLinkActive="active">{{ item.label }}</a>
            </li>
          }
        </ul>
        <a href="/admin/queues" target="_blank" rel="noopener" class="queues-link">Job queues (Bull Board) ↗</a>
      </nav>

      <div class="content">
        <router-outlet />
      </div>
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    :host {
      display: block;
      min-height: 100dvh;
      background: var(--color-neutral-01);
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr;
      min-height: 100dvh;

      @include bp.wide-up {
        grid-template-columns: 240px 1fr;
      }
    }

    .sidebar {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-6) var(--space-4);
      background: var(--color-neutral-07);
      color: var(--color-neutral-01);

      @include bp.wide-up {
        position: sticky;
        top: 0;
        height: 100dvh;
        overflow-y: auto;
      }
    }

    .wordmark {
      @include type.body-1-semi;
      margin-bottom: var(--space-1);
      color: var(--color-white);

      span {
        color: var(--color-neutral-04);
      }
    }

    .role {
      @include type.caption-2;
      margin: 0 0 var(--space-5);
      color: var(--color-neutral-04);
    }

    ul {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      margin: 0 0 var(--space-6);
      padding: 0;
      list-style: none;
    }

    a {
      @include type.caption-1-semi;
      display: block;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-md);
      color: var(--color-neutral-03);

      &.active {
        background: var(--color-white);
        color: var(--color-neutral-07);
      }
    }

    // Guarded so a touch tap doesn't leave the link stuck in its hover
    // overlay with no mouseleave to clear it — same treatment as
    // shared/ui's interactive primitives. Excluded on .active: the solid
    // white active fill already reads as selected, a hover overlay on
    // top of it would just look like a glitch.
    @media (hover: hover) and (pointer: fine) {
      a:hover:not(.active) {
        background: color-mix(in srgb, var(--color-white) 8%, transparent);
        color: var(--color-white);
      }
    }

    .queues-link {
      @include type.caption-2;
      margin-top: auto;
      color: var(--color-neutral-04);
      text-decoration: underline;
    }

    .content {
      min-width: 0;
      padding: var(--space-6) var(--page-padding);

      @include bp.wide-up {
        padding: var(--space-8);
      }
    }
  `,
})
export default class AdminShell implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly tokens = inject(TokenStore);
  private readonly router = inject(Router);

  protected readonly role = computed(() => this.tokens.role() ?? '');

  protected readonly visibleNavItems = computed(() => {
    const role = this.tokens.role();
    return NAV_ITEMS.filter((item) => role && item.roles.includes(role));
  });

  ngOnInit(): void {
    this.auth.loadCurrentUser().subscribe({
      // The user's own role no longer matching any admin area (e.g. an
      // admin demoted mid-session) means the shell has nothing to show —
      // send them back to the storefront rather than an empty sidebar.
      next: () => {
        if (this.visibleNavItems().length === 0) void this.router.navigateByUrl('/');
      },
    });
  }
}
