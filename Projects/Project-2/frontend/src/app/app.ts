import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CartDrawer } from '@/app/shared/ui/cart-drawer';
import { IconSprite } from '@/app/shared/ui/icon-sprite';
import { MobileMenu } from '@/app/shared/ui/mobile-menu';
import { SiteFooter, type FooterLinkColumn } from '@/app/shared/ui/site-footer';
import { SiteHeader, type NavItem } from '@/app/shared/ui/site-header';
import { SkipLink } from '@/app/shared/ui/skip-link';
import { ToastStack } from '@/app/shared/ui/toast-stack';

@Component({
  selector: 'store-root',
  imports: [RouterOutlet, IconSprite, ToastStack, SkipLink, SiteHeader, SiteFooter, MobileMenu, CartDrawer],
  template: `
    <icon-sprite />
    <toast-stack />
    <skip-link />
    <site-header
      [navItems]="navItems"
      (menuToggle)="mobileMenuOpen.set(true)"
      (cartToggle)="cartOpen.set(true)"
    />
    <main id="main-content">
      <router-outlet />
    </main>
    <site-footer [columns]="footerColumns" [year]="2026">More than just a game. It's a lifestyle.</site-footer>
    <mobile-menu [open]="mobileMenuOpen()" (openChange)="mobileMenuOpen.set($event)" [navItems]="navItems" />
    <cart-drawer [open]="cartOpen()" (openChange)="cartOpen.set($event)" />
  `,
})
export class App {
  protected readonly navItems: NavItem[] = [
    { label: 'Home', link: ['/'] },
    { label: 'Shop', link: ['/'] },
    { label: 'Product', link: ['/'] },
    { label: 'Contact Us', link: ['/'] },
  ];

  // Matches the real Figma footer structure (Page/Info columns), found
  // while fetching Homepage 03's design context for Phase F4 — not the
  // earlier Company/Help/Legal columns this started with.
  protected readonly footerColumns: FooterLinkColumn[] = [
    {
      title: 'Page',
      links: [
        { label: 'Home', link: ['/'] },
        { label: 'Shop', link: ['/'] },
        { label: 'Product', link: ['/'] },
        { label: 'Articles', link: ['/'] },
        { label: 'Contact Us', link: ['/'] },
      ],
    },
    {
      title: 'Info',
      links: [
        { label: 'Shipping Policy', link: ['/'] },
        { label: 'Support', link: ['/'] },
        { label: 'FAQs', link: ['/'] },
      ],
    },
  ];

  protected readonly mobileMenuOpen = signal(false);
  protected readonly cartOpen = signal(false);
}
