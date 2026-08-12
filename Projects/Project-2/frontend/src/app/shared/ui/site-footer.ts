import { Component, input, output, signal } from '@angular/core';

import { ActionButton } from './action-button';
import type { NavItem } from './site-header';
import { NavLink } from './nav-link';
import { PageContainer } from './page-container';
import { TextField } from './text-field';

export interface FooterLinkColumn {
  readonly title: string;
  readonly links: NavItem[];
}

/**
 * `year` is a plain input rather than computed from `new Date()` inside
 * this component — reading the clock directly in presentation code risks
 * an SSR/client mismatch if a render happens to straddle midnight on
 * Dec 31 (project rule: don't assume globals like Date() are safely
 * available/consistent). Callers should pass the real current year from
 * wherever it's computed once, server-side.
 */
@Component({
  selector: 'site-footer',
  imports: [PageContainer, NavLink, TextField, ActionButton],
  template: `
    <footer class="site-footer">
      <page-container>
        <div class="site-footer__top">
          <div class="site-footer__brand">
            <p class="site-footer__logo">3legant</p>
            <p class="site-footer__tagline"><ng-content /></p>
          </div>
          @for (column of columns(); track column.title) {
            <div class="site-footer__column">
              <h3>{{ column.title }}</h3>
              <ul role="list">
                @for (link of column.links; track link.label) {
                  <li><nav-link [link]="link.link">{{ link.label }}</nav-link></li>
                }
              </ul>
            </div>
          }
          <div class="site-footer__newsletter">
            <h3>Join Our Newsletter</h3>
            <form class="site-footer__newsletter-form" (submit)="onSubmit($event)">
              <text-field
                placeholder="Enter your email"
                type="email"
                [value]="email()"
                (valueChange)="email.set($event)"
              />
              <action-button type="submit" size="s">Subscribe</action-button>
            </form>
          </div>
        </div>
      </page-container>
      <div class="site-footer__bottom">
        <page-container class="site-footer__bottom-inner">
          <p>&copy; {{ year() }} 3legant Golf. All rights reserved.</p>
        </page-container>
      </div>
    </footer>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .site-footer {
      background: var(--color-neutral-01);
      border-top: 1px solid var(--color-neutral-03);
    }

    .site-footer__top {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-8);
      padding-block: var(--space-10);

      @include bp.tablet-up {
        grid-template-columns: 1.5fr repeat(3, 1fr) 1.5fr;
      }
    }

    .site-footer__logo {
      @include type.headline-7;
      font-family: var(--font-poppins);
      font-weight: 500;
      margin-bottom: var(--space-3);
    }

    .site-footer__tagline {
      @include type.caption-1;
      color: var(--color-neutral-04);
    }

    .site-footer__column h3,
    .site-footer__newsletter h3 {
      @include type.caption-1-semi;
      margin-bottom: var(--space-4);
    }

    .site-footer__column ul {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .site-footer__newsletter-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }

    .site-footer__bottom {
      border-top: 1px solid var(--color-neutral-03);
    }

    .site-footer__bottom-inner {
      display: flex;
      align-items: center;
      block-size: 96px;
    }

    .site-footer__bottom-inner p {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }
  `,
})
export class SiteFooter {
  readonly columns = input<FooterLinkColumn[]>([]);
  readonly year = input(2026);
  readonly subscribe = output<string>();

  protected readonly email = signal('');

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.email()) return;
    this.subscribe.emit(this.email());
    this.email.set('');
  }
}
