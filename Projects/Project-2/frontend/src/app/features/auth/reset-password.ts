import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, form, minLength, required } from '@angular/forms/signals';

import { AuthService } from '@/app/core/services/auth.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';

/**
 * Reached from the reset-password email link (`?token=...`), never
 * navigated to directly within the app.
 *
 * The password-match check is deliberately NOT wired through Signal
 * Forms' validate()/validateTree() cross-field machinery — it's one
 * boolean comparison between two fields on one small form, and a plain
 * computed() says exactly the same thing with far less to learn from the
 * API surface. Signal Forms still owns required/minLength on both fields.
 */
@Component({
  selector: 'reset-password-page',
  imports: [RouterLink, ActionButton, RevealDirective, FormField],
  template: `
    <div class="shell" reveal>
      <div class="card">
        @if (!token()) {
          <h1>Invalid link</h1>
          <p class="subhead">
            This password reset link is missing its token. Request a new one below.
          </p>
          <a class="back" routerLink="/forgot-password">Request a new link</a>
        } @else if (done()) {
          <h1>Password updated</h1>
          <p class="subhead">Your password has been changed. You can sign in now.</p>
          <a class="back" routerLink="/sign-in">Go to sign in</a>
        } @else {
          <h1>Set a new password</h1>
          <p class="subhead">Choose a new password for your account.</p>

          <form (submit)="onSubmit($event)" novalidate>
            <div class="field">
              <label for="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                autocomplete="new-password"
                [formField]="resetForm.newPassword"
              />
              @if (resetForm.newPassword().touched() && resetForm.newPassword().errors()[0]; as err) {
                <p class="error">{{ err.message }}</p>
              } @else {
                <p class="hint">At least 8 characters.</p>
              }
            </div>

            <div class="field">
              <label for="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                autocomplete="new-password"
                [formField]="resetForm.confirmPassword"
              />
              @if (resetForm.confirmPassword().touched() && !passwordsMatch()) {
                <p class="error">Passwords don't match</p>
              }
            </div>

            <action-button
              type="submit"
              size="m"
              [fullWidth]="true"
              [disabled]="!passwordsMatch()"
              [loading]="submitting()"
            >
              Update password
            </action-button>
          </form>
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
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    label {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
    }

    input {
      @include type.body-2;
      height: 48px;
      padding: 0 16px;
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-border-input);
      color: var(--color-neutral-07);

      &:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 1px var(--color-info);
      }
    }

    .error {
      @include type.caption-2;
      margin: 0;
      color: var(--color-error);
    }

    .hint {
      @include type.caption-2;
      margin: 0;
      color: var(--color-neutral-04);
    }

    .back {
      @include type.caption-1-semi;
      display: inline-block;
      color: var(--color-neutral-07);
    }
  `,
})
export default class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly token = input<string>();

  protected readonly submitting = signal(false);
  protected readonly done = signal(false);

  private readonly model = signal({ newPassword: '', confirmPassword: '' });

  protected readonly resetForm = form(this.model, (f) => {
    required(f.newPassword, { message: 'Password is required' });
    minLength(f.newPassword, 8, { message: 'Password must be at least 8 characters' });
    required(f.confirmPassword, { message: 'Please confirm your password' });
  });

  protected readonly passwordsMatch = computed(() => {
    const { newPassword, confirmPassword } = this.model();
    return confirmPassword.length > 0 && newPassword === confirmPassword;
  });

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.resetForm().markAsTouched();
    const tokenValue = this.token();
    if (!tokenValue || !this.resetForm().valid() || !this.passwordsMatch() || this.submitting()) return;

    this.submitting.set(true);
    this.auth.resetPassword(tokenValue, this.model().newPassword).subscribe({
      next: () => {
        this.submitting.set(false);
        this.done.set(true);
      },
      error: () => this.submitting.set(false),
    });
  }
}
