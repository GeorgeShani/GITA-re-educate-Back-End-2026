import { Component, DestroyRef, afterNextRender, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NewsletterService } from '@/app/core/services/newsletter.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';

type Status = 'pending' | 'confirming' | 'success' | 'error';

/**
 * Reached from the double opt-in confirmation email (`?email=&token=`).
 * Same "no form, fire once, report the outcome" shape as verify-email.ts.
 * No MJML template exists for the confirmation email itself yet
 * (newsletter.controller.ts's own comment), so this page only does
 * anything real when reached with a genuine token — not reachable from
 * anywhere else in this app.
 */
@Component({
  selector: 'newsletter-confirm-page',
  imports: [RouterLink, RevealDirective],
  template: `
    <div class="shell" reveal>
      <div class="card">
        @switch (status()) {
          @case ('confirming') {
            <h1>Confirming…</h1>
            <p class="subhead">One moment while we confirm your subscription.</p>
          }
          @case ('success') {
            <h1>Subscription confirmed</h1>
            <p class="subhead">You're on the list for deals, new products, and promotions.</p>
            <a class="back" routerLink="/">Continue shopping</a>
          }
          @default {
            <h1>Confirmation failed</h1>
            <p class="subhead">This link is invalid or has expired.</p>
            <a class="back" routerLink="/">Back to the shop</a>
          }
        }
      </div>
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    .shell {
      display: flex;
      justify-content: center;
      padding: calc(var(--space-10) * 1.5) var(--page-padding);
      min-height: 70vh;
    }

    .card {
      width: 100%;
      max-width: 26rem;
      text-align: center;
    }

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .subhead {
      @include type.body-2;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-04);
    }

    .back {
      @include type.caption-1-semi;
      display: inline-block;
      color: var(--color-neutral-07);
    }
  `,
})
export default class NewsletterConfirm {
  private readonly newsletter = inject(NewsletterService);
  private readonly destroyRef = inject(DestroyRef);

  readonly email = input<string>();
  readonly token = input<string>();

  protected readonly status = signal<Status>('pending');

  constructor() {
    afterNextRender(() => {
      const emailValue = this.email();
      const tokenValue = this.token();
      if (!emailValue || !tokenValue) {
        this.status.set('error');
        return;
      }
      this.status.set('confirming');
      const sub = this.newsletter.confirm(emailValue, tokenValue).subscribe({
        next: () => this.status.set('success'),
        error: () => this.status.set('error'),
      });
      this.destroyRef.onDestroy(() => sub.unsubscribe());
    });
  }
}
