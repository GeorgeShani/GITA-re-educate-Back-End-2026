import { Component, afterNextRender, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { CartService } from '@/app/core/services/cart.service';
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
  ],
  template: `
    <icon-sprite />
    <toast-stack />
    <skip-link />
    <notification-bar />
    <site-header />
    <main id="main-content">
      <router-outlet />
    </main>
    <site-footer />
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

  constructor() {
    // Browser-only: the guest cart is identified by a cookie the server sets,
    // and issuing that during SSR would mint a cart for every crawler.
    afterNextRender(() => {
      this.cart.load().subscribe({ error: () => undefined });
    });
  }
}
