import { Component, inject, signal } from '@angular/core';

import { NewsletterService } from '@/app/core/services/newsletter.service';
import { inputValue } from '@/app/core/util/dom-event';
import { ActionButton } from '@/app/shared/ui/action-button';

@Component({
  selector: 'newsletter-signup',
  imports: [ActionButton],
  template: `
    <div class="banner">
      <div class="banner-scrim"></div>
      <div class="content">
        <h2>Join our newsletter</h2>
        <p>Sign up for deals, new products, and promotions.</p>

        @if (submitted()) {
          <p class="confirmation" role="status">You're on the list — thank you.</p>
        } @else {
          <form class="form" (submit)="submit($event)">
            <input
              type="email"
              name="email"
              required
              aria-label="Email address"
              placeholder="Email address"
              [value]="email()"
              [disabled]="submitting()"
              (input)="email.set(inputValue($event))"
            />
            <action-button type="submit" size="s" [loading]="submitting()" [disabled]="!email().trim()">
              Sign up
            </action-button>
          </form>
        }
      </div>
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    .banner {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 320px;
      padding: var(--space-10) var(--space-6);
      background: var(--color-neutral-07);
    }

    .content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-5);
      max-width: 34rem;
      text-align: center;
    }

    h2 {
      @include type.headline-5;
      margin: 0;
      color: var(--color-neutral-01);
    }

    p {
      @include type.body-1;
      margin: 0;
      color: color-mix(in srgb, var(--color-neutral-01) 85%, transparent);
    }

    .confirmation {
      color: var(--color-success);
    }

    // A real field on a white pill — same shape as the search box — instead
    // of a borderless underline the rest of the site never uses.
    .form {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      width: 100%;
      max-width: 26rem;
      margin-top: var(--space-1);
      padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4);
      border-radius: var(--radius-full);
      background: var(--color-white);
    }

    input {
      @include type.body-2;
      flex: 1;
      min-width: 0;
      height: 36px;
      border: none;
      background: transparent;
      color: var(--color-neutral-07);

      &::placeholder {
        color: var(--color-neutral-04);
      }

      &:focus-visible {
        outline: none;
      }
    }
  `,
})
export class NewsletterSignup {
  private readonly newsletter = inject(NewsletterService);

  protected readonly inputValue = inputValue;
  protected readonly email = signal('');
  protected readonly submitted = signal(false);
  protected readonly submitting = signal(false);

  // subscribe() is deliberately silent on "already subscribed"
  // (newsletter.service.ts) — so the confirmation shows the same way
  // whether this is a new address or a repeat signup, matching the
  // backend's own "never confirm or deny to an unauthenticated caller".
  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const value = this.email().trim();
    if (!value || this.submitting()) return;

    this.submitting.set(true);
    this.newsletter.subscribe(value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
      },
      error: () => this.submitting.set(false),
    });
  }
}
