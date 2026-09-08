import { Component, DestroyRef, afterNextRender, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NewsletterService } from '@/app/core/services/newsletter.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';

type Status = 'pending' | 'unsubscribing' | 'success' | 'error';

/** Reached from a one-click unsubscribe email link (`?email=&token=`) — see newsletter-confirm.ts for the shared shape/rationale. */
@Component({
  selector: 'newsletter-unsubscribe-page',
  imports: [RouterLink, RevealDirective],
  template: `
    <div class="shell" reveal>
      <div class="card">
        @switch (status()) {
          @case ('unsubscribing') {
            <h1>One moment…</h1>
            <p class="subhead">Processing your request.</p>
          }
          @case ('success') {
            <h1>You've been unsubscribed</h1>
            <p class="subhead">You won't receive marketing emails from us anymore.</p>
            <a class="back" routerLink="/">Back to the shop</a>
          }
          @default {
            <h1>Something went wrong</h1>
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
export default class NewsletterUnsubscribe {
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
      this.status.set('unsubscribing');
      const sub = this.newsletter.unsubscribe(emailValue, tokenValue).subscribe({
        next: () => this.status.set('success'),
        error: () => this.status.set('error'),
      });
      this.destroyRef.onDestroy(() => sub.unsubscribe());
    });
  }
}
