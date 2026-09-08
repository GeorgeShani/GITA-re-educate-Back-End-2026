import { Component, afterNextRender, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { CartService } from '@/app/core/services/cart.service';
import { AssistantPanel } from '@/app/features/assistant/assistant-panel';
import { NotificationBar } from '@/app/shared/layout/notification-bar';
import { SiteFooter } from '@/app/shared/layout/site-footer';
import { SiteHeader } from '@/app/shared/layout/site-header';
import { IconSprite } from '@/app/shared/ui/icon-sprite';
import { SkipLink } from '@/app/shared/ui/skip-link';
import { ToastStack } from '@/app/shared/ui/toast-stack';

@Component({
  selector: 'store-root',
  imports: [
    RouterOutlet,
    IconSprite,
    ToastStack,
    SkipLink,
    NotificationBar,
    SiteHeader,
    SiteFooter,
    AssistantPanel,
  ],
  template: `
    <icon-sprite />
    <toast-stack />
    @if (!isAdminRoute()) {
      <skip-link />
      <notification-bar />
      <site-header />
    }
    <main id="main-content">
      <router-outlet />
    </main>
    @if (!isAdminRoute()) {
      <site-footer />
      <assistant-panel />
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    main {
      flex: 1;
    }
  `,
})
export class App {
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  // The admin console is a separate surface from the storefront (staff
  // only, its own shell/nav in admin-shell.ts) — the customer-facing
  // header/footer/notification-bar/assistant FAB have no business
  // showing on top of it. Derived from Router events rather than a
  // routeConfig flag since this needs to react to in-app navigation
  // between the two surfaces, not just the initial load.
  protected readonly isAdminRoute = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects.startsWith('/admin')),
      startWith(this.router.url.startsWith('/admin')),
    ),
    { initialValue: this.router.url.startsWith('/admin') },
  );

  constructor() {
    // Browser-only: the guest cart is identified by a cookie the server sets,
    // and issuing that during SSR would mint a cart for every crawler.
    afterNextRender(() => {
      this.cart.load().subscribe({ error: () => undefined });
    });
  }
}
