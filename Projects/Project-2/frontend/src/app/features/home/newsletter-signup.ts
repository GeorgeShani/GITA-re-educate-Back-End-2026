import { NgOptimizedImage } from '@angular/common';
import { Component, inject, signal } from '@angular/core';

import { NewsletterService } from '@/app/core/services/newsletter.service';
import { inputValue } from '@/app/core/util/dom-event';
import { IconGlyph } from '@/app/shared/ui/icon-glyph';

@Component({
  selector: 'newsletter-signup',
  imports: [NgOptimizedImage, IconGlyph],
  template: `
    <div class="banner">
      <img
        ngSrc="/images/products/sale-banner.jpg"
        alt=""
        fill
        priority="false"
        class="banner-image"
      />
      <div class="banner-scrim"></div>
      <div class="content">
        <h2>Join Our Newsletter</h2>
        <p>Sign up for deals, new products and promotions</p>

        @if (submitted()) {
          <p class="confirmation" role="status">You're on the list — thank you.</p>
        } @else {
          <form class="form" (submit)="submit($event)">
            <icon-glyph name="mail" [size]="20" />
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
            <button type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Signing up...' : 'Signup' }}
            </button>
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
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 320px;
      padding: var(--space-10) var(--space-6);
      overflow: hidden;
      background: var(--color-neutral-07);
    }

    .banner-image {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: grayscale(1);
    }

    .banner-scrim {
      position: absolute;
      inset: 0;
      background: color-mix(in srgb, var(--color-neutral-07) 88%, transparent);
    }

    .content {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-6);
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

    .form {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: 100%;
      max-width: 30rem;
      padding-bottom: var(--space-3);
      border-bottom: 1px solid var(--color-neutral-01);
      color: var(--color-neutral-01);

      icon-glyph {
        flex-shrink: 0;
      }

      input {
        flex: 1;
        min-width: 0;
        background: transparent;
        border: none;
        color: var(--color-neutral-01);

        &::placeholder {
          color: color-mix(in srgb, var(--color-neutral-01) 70%, transparent);
        }

        &:focus-visible {
          outline: none;
        }

        &:disabled {
          opacity: 0.6;
        }
      }

      button {
        flex-shrink: 0;
        background: transparent;
        border: none;
        padding: 0;
        color: var(--color-neutral-01);
        @include type.button-s;

        &:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }
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
