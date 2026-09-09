import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, email, form, required } from '@angular/forms/signals';

import { AuthService } from '@/app/core/services/auth.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { TextField } from '@/app/shared/ui/text-field';

/**
 * The backend always returns success here regardless of whether the
 * address is registered (see auth.controller.ts's own comment on the
 * route) — so the client shows one generic message either way. Branching
 * the UI on "found" vs "not found" would leak exactly the account
 * enumeration the backend went out of its way to avoid.
 */
@Component({
  selector: 'forgot-password-page',
  imports: [RouterLink, ActionButton, RevealDirective, FormField, TextField],
  template: `
    <div class="shell" reveal>
      <div class="card">
        @if (sent()) {
          <h1>Check your email</h1>
          <p class="subhead">
            If an account exists for that address, we've sent a link to reset your password.
          </p>
          <a class="back" routerLink="/sign-in">Back to sign in</a>
        } @else {
          <h1>Forgot password</h1>
          <p class="subhead">Enter your email and we'll send you a reset link.</p>

          <form (submit)="onSubmit($event)" novalidate>
            <text-field
              label="Email"
              type="email"
              [height]="48"
              autocomplete="email"
              [formField]="requestForm.email"
            />

            <action-button type="submit" size="m" [fullWidth]="true" [loading]="submitting()">
              Send reset link
            </action-button>
          </form>

          <a class="back" routerLink="/sign-in">Back to sign in</a>
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
    }

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .subhead {
      @include type.body-2;
      margin: 0 0 var(--space-8);
      color: var(--color-neutral-04);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      margin-bottom: var(--space-6);
    }

    .back {
      @include type.caption-1-semi;
      display: inline-block;
      color: var(--color-neutral-07);
    }
  `,
})
export default class ForgotPassword {
  private readonly auth = inject(AuthService);

  protected readonly submitting = signal(false);
  protected readonly sent = signal(false);

  private readonly model = signal({ email: '' });

  protected readonly requestForm = form(this.model, (f) => {
    required(f.email, { message: 'Email is required' });
    email(f.email, { message: 'Enter a valid email address' });
  });

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.requestForm().markAsTouched();
    if (!this.requestForm().valid() || this.submitting()) return;

    this.submitting.set(true);
    this.auth.forgotPassword(this.model().email).subscribe({
      // Same generic success on error too, EXCEPT the throttle case — a
      // 429 needs to be seen (error.interceptor already toasts it), not
      // silently painted over as "check your email" when nothing was sent.
      next: () => {
        this.submitting.set(false);
        this.sent.set(true);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        if (!(err instanceof Object && 'status' in err && err.status === 429)) {
          this.sent.set(true);
        }
      },
    });
  }
}
