import { Component, DestroyRef, afterNextRender, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '@/app/core/services/auth.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';

type Status = 'pending' | 'verifying' | 'success' | 'error';

/**
 * Reached from the verification email link (`?token=...`). No form here —
 * the token does the whole job, so the only job of this page is to fire
 * the request once and report what happened.
 */
@Component({
  selector: 'verify-email-page',
  imports: [RouterLink, RevealDirective],
  template: `
    <div class="shell" reveal>
      <div class="card">
        @switch (status()) {
          @case ('verifying') {
            <h1>Verifying…</h1>
            <p class="subhead">One moment while we confirm your email address.</p>
          }
          @case ('success') {
            <h1>Email verified</h1>
            <p class="subhead">Your email address has been confirmed.</p>
            <a class="back" routerLink="/">Continue to the shop</a>
          }
          @default {
            <h1>Verification failed</h1>
            <p class="subhead">
              This link is invalid or has expired. Sign in and request a new one from your account.
            </p>
            <a class="back" routerLink="/sign-in">Go to sign in</a>
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
export default class VerifyEmail {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly token = input<string>();

  protected readonly status = signal<Status>('pending');

  constructor() {
    afterNextRender(() => {
      const tokenValue = this.token();
      if (!tokenValue) {
        this.status.set('error');
        return;
      }
      this.status.set('verifying');
      const sub = this.auth.verifyEmail(tokenValue).subscribe({
        next: () => this.status.set('success'),
        error: () => this.status.set('error'),
      });
      this.destroyRef.onDestroy(() => sub.unsubscribe());
    });
  }
}
