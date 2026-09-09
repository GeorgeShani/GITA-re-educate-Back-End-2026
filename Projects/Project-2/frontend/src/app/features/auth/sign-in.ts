import { Component, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, email, form, required } from '@angular/forms/signals';

import { AuthService } from '@/app/core/services/auth.service';
import { CartService } from '@/app/core/services/cart.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { TextField } from '@/app/shared/ui/text-field';

/**
 * `redirectTo` arrives from `authGuard`'s query param when someone is
 * bounced here mid-navigation — binds automatically via
 * withComponentInputBinding(), same mechanism as a route param.
 */
@Component({
  selector: 'sign-in-page',
  imports: [RouterLink, ActionButton, RevealDirective, FormField, TextField],
  template: `
    <div class="shell" reveal>
      <div class="card">
        <h1>Sign in</h1>
        <p class="subhead">Welcome back to 3legant Golf.</p>

        <form (submit)="onSubmit($event)" novalidate>
          <text-field
            label="Email"
            type="email"
            [height]="48"
            autocomplete="email"
            [formField]="signInForm.email"
          />
          <text-field
            label="Password"
            type="password"
            [height]="48"
            autocomplete="current-password"
            [formField]="signInForm.password"
          />

          <a class="forgot" routerLink="/forgot-password">Forgot password?</a>

          <action-button type="submit" size="m" [fullWidth]="true" [loading]="submitting()">
            Sign in
          </action-button>
        </form>

        <p class="switch">
          New here?
          <a routerLink="/sign-up">Create an account</a>
        </p>
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

    .forgot {
      @include type.caption-1;
      align-self: end;
      margin-top: calc(var(--space-5) * -1 + var(--space-1));
      color: var(--color-neutral-05);
    }

    .switch {
      @include type.body-2;
      margin: var(--space-6) 0 0;
      text-align: center;
      color: var(--color-neutral-04);

      a {
        color: var(--color-neutral-07);
        font-weight: 600;
      }
    }
  `,
})
export default class SignIn {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  readonly redirectTo = input('/');

  protected readonly submitting = signal(false);

  private readonly model = signal({ email: '', password: '' });

  protected readonly signInForm = form(this.model, (f) => {
    required(f.email, { message: 'Email is required' });
    email(f.email, { message: 'Enter a valid email address' });
    required(f.password, { message: 'Password is required' });
  });

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.signInForm().markAsTouched();
    if (!this.signInForm().valid() || this.submitting()) return;

    const { email: emailValue, password } = this.model();
    this.submitting.set(true);

    this.auth.login(emailValue, password).subscribe({
      next: () => {
        // Guest cart items fold into the just-authenticated user's cart —
        // must happen right after login, this is the only moment the
        // server can still see both carts to merge them.
        this.cart.mergeGuestCart().subscribe();
        this.router.navigateByUrl(this.redirectTo());
      },
      error: () => this.submitting.set(false),
    });
  }
}
