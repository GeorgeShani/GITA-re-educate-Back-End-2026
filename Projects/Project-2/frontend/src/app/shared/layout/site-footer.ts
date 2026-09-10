import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { PageContainer } from '@/app/shared/ui/page-container';

const PAGE_LINKS = [
  { label: 'Home', link: '/' },
  { label: 'Shop', link: '/shop' },
  { label: 'Journal', link: '/blog' },
  { label: 'About', link: '/about' },
  { label: 'Contact', link: '/contact' },
] as const;

const INFO_LINKS = [
  { label: 'Shipping policy', link: '/shipping' },
  { label: 'Returns & refunds', link: '/returns' },
  { label: 'FAQs', link: '/faq' },
  { label: 'Privacy policy', link: '/privacy' },
  { label: 'Terms of service', link: '/terms' },
] as const;

/** Brand marks are decorative here — the payment row is informational. */
const PAYMENT_ICONS = ['visa', 'mastercard', 'amex', 'paypal', 'applepay'] as const;
const SOCIAL = [
  { icon: 'instagram', label: 'Instagram', href: 'https://instagram.com' },
  { icon: 'facebook', label: 'Facebook', href: 'https://facebook.com' },
  { icon: 'youtube', label: 'YouTube', href: 'https://youtube.com' },
] as const;

@Component({
  selector: 'site-footer',
  imports: [RouterLink, PageContainer, IconGlyph],
  template: `
    <page-container>
      <div class="top">
        <div class="brand">
          <p class="wordmark">
            <icon-glyph name="golf-mark" [size]="22" class="icon" />3legant<span>.</span>
          </p>
          <p class="tagline">More than just a game. It&rsquo;s a lifestyle.</p>
          <ul class="social" role="list">
            @for (item of social; track item.icon) {
              <li>
                <a
                  [href]="item.href"
                  rel="noopener noreferrer"
                  target="_blank"
                  [attr.aria-label]="item.label"
                >
                  <icon-glyph [name]="item.icon" [size]="20" />
                </a>
              </li>
            }
          </ul>
        </div>

        <nav class="column" aria-label="Pages">
          <h2>Pages</h2>
          <ul role="list">
            @for (item of pageLinks; track item.link) {
              <li>
                <a [routerLink]="item.link">{{ item.label }}</a>
              </li>
            }
          </ul>
        </nav>

        <nav class="column" aria-label="Information">
          <h2>Info</h2>
          <ul role="list">
            @for (item of infoLinks; track item.label) {
              <li>
                <a [routerLink]="item.link">{{ item.label }}</a>
              </li>
            }
          </ul>
        </nav>
      </div>

      <div class="bottom">
        <p class="copyright">&copy; {{ year }} 3legant. All rights reserved.</p>
        <ul class="payments" role="list" aria-label="Accepted payment methods">
          @for (icon of paymentIcons; track icon) {
            <li><icon-glyph [name]="icon" [size]="28" /></li>
          }
        </ul>
      </div>
    </page-container>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    :host {
      display: block;
      margin-top: auto;
      padding-block: var(--space-10);
      background: var(--color-neutral-02);
      color: var(--color-neutral-05);
      // Own snapshot group for the route cross-fade (styles/_view-transitions.scss)
      // so the footer holds still across a real route change instead of
      // fading with the rest of the page.
      view-transition-name: site-footer;
    }

    .top {
      display: grid;
      gap: var(--space-8);

      @include bp.tablet-up {
        grid-template-columns: 2fr 1fr 1fr;
      }
    }

    .wordmark {
      @include type.headline-7;
      display: flex;
      align-items: center;
      margin: 0;
      color: var(--color-neutral-07);

      // No colour rule for icon-glyph here — "golf-mark" carries its own
      // fixed brand colours (see build-icon-sprite.mjs's LOGO comment), so
      // it renders identically wherever it's placed instead of adapting to
      // currentColor like every other icon in the sprite.

      .icon {
        margin-right: var(--space-2);
      }

      span {
        color: var(--color-success);
      }
    }

    .tagline {
      @include type.body-2;
      max-width: 28ch;
      margin: var(--space-3) 0 var(--space-5);
    }

    .social {
      display: flex;
      gap: var(--space-5);
      margin: 0;
      padding: 0;

      a {
        color: var(--color-neutral-07);
      }
    }

    .column h2 {
      @include type.caption-1-semi;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);
    }

    .column ul {
      display: grid;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
    }

    .column a {
      @include type.caption-1;
    }

    // Guarded so a touch tap doesn't leave the link stuck darkened with
    // no mouseleave to un-hover it — same treatment as shared/ui's
    // interactive primitives (e.g. nav-link.ts).
    @media (hover: hover) and (pointer: fine) {
      .column a:hover {
        color: var(--color-neutral-07);
      }
    }

    .bottom {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin-top: var(--space-10);
      padding-top: var(--space-6);
      border-top: 1px solid var(--color-neutral-03);
    }

    .copyright {
      @include type.caption-2;
      margin: 0;
    }

    .payments {
      display: flex;
      gap: var(--space-4);
      margin: 0;
      padding: 0;
      color: var(--color-neutral-04);
    }
  `,
})
export class SiteFooter {
  protected readonly pageLinks = PAGE_LINKS;
  protected readonly infoLinks = INFO_LINKS;
  protected readonly paymentIcons = PAYMENT_ICONS;
  protected readonly social = SOCIAL;
  // Evaluated once at construction — AGENTS.md forbids assuming globals in
  // templates, and a footer year does not need to be reactive.
  protected readonly year = new Date().getFullYear();
}
