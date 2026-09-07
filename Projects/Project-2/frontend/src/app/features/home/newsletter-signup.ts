import { NgOptimizedImage } from '@angular/common';
import { Component, signal } from '@angular/core';

import { IconGlyph } from '@/app/shared/ui/icon-glyph';

/**
 * No newsletter endpoint exists on the backend yet (Phase F9 — content).
 * The form validates and shows a confirmation state locally; wiring the
 * real POST is a follow-up once that route lands, not a silent no-op.
 */
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
              placeholder="Email address"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
            />
            <button type="submit">Signup</button>
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
      isolation: isolate;
    }

    .banner-image {
      object-fit: cover;
      z-index: -2;
      filter: grayscale(1);
    }

    .banner-scrim {
      position: absolute;
      inset: 0;
      z-index: -1;
      background: color-mix(in srgb, var(--color-neutral-07) 88%, transparent);
    }

    .content {
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
      }

      button {
        flex-shrink: 0;
        background: transparent;
        border: none;
        padding: 0;
        color: var(--color-neutral-01);
        @include type.button-s;
      }
    }
  `,
})
export class NewsletterSignup {
  protected readonly email = signal('');
  protected readonly submitted = signal(false);

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.email().trim()) return;
    this.submitted.set(true);
  }
}
