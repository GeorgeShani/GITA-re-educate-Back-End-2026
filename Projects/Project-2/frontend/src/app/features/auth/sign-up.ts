import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormField, email, form, minLength, required } from '@angular/forms/signals';

import { AuthService } from '@/app/core/services/auth.service';
import { CartService } from '@/app/core/services/cart.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';

interface SignUpModel {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

@Component({
  selector: 'sign-up-page',
  imports: [RouterLink, ActionButton, RevealDirective, FormField],
  template: `
    <div class="shell" reveal>
      <div class="card">
        <h1>Create an account</h1>
        <p class="subhead">Join 3legant Golf.</p>

        <form (submit)="onSubmit($event)" novalidate>
          <div class="row">
            <div class="field">
              <label for="firstName">First name</label>
              <input id="firstName" type="text" autocomplete="given-name" [formField]="signUpForm.firstName" />
              @if (signUpForm.firstName().touched() && signUpForm.firstName().errors()[0]; as err) {
                <p class="error">{{ err.message }}</p>
              }
            </div>
            <div class="field">
              <label for="lastName">Last name</label>
              <input id="lastName" type="text" autocomplete="family-name" [formField]="signUpForm.lastName" />
              @if (signUpForm.lastName().touched() && signUpForm.lastName().errors()[0]; as err) {
                <p class="error">{{ err.message }}</p>
              }
            </div>
          </div>

          <div class="field">
            <label for="email">Email</label>
            <input id="email" type="email" autocomplete="email" [formField]="signUpForm.email" />
            @if (signUpForm.email().touched() && signUpForm.email().errors()[0]; as err) {
              <p class="error">{{ err.message }}</p>
            }
          </div>

          <div class="field">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              autocomplete="new-password"
              [formField]="signUpForm.password"
            />
            @if (signUpForm.password().touched() && signUpForm.password().errors()[0]; as err) {
              <p class="error">{{ err.message }}</p>
            } @else {
              <p class="hint">At least 8 characters.</p>
            }
          </div>

          <action-button type="submit" size="m" [fullWidth]="true" [loading]="submitting()">
            Create account
          </action-button>
        </form>

        <p class="switch">
          Already have an account?
          <a routerLink="/sign-in">Sign in</a>
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
      max-width: 28rem;
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

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
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
export default class SignUp {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  protected readonly submitting = signal(false);

  private readonly model = signal<SignUpModel>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  // Client-side minLength(8) mirrors backend RegisterDto's @MinLength(8)
  // exactly (backend/src/auth/dto/register.dto.ts) — a looser rule here
  // would just mean the 400 from the server is the first time the user
  // hears about it.
  protected readonly signUpForm = form(this.model, (f) => {
    required(f.firstName, { message: 'First name is required' });
    required(f.lastName, { message: 'Last name is required' });
    required(f.email, { message: 'Email is required' });
    email(f.email, { message: 'Enter a valid email address' });
    required(f.password, { message: 'Password is required' });
    minLength(f.password, 8, { message: 'Password must be at least 8 characters' });
  });

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.signUpForm().markAsTouched();
    if (!this.signUpForm().valid() || this.submitting()) return;

    this.submitting.set(true);

    this.auth.register(this.model()).subscribe({
      next: () => {
        this.cart.mergeGuestCart().subscribe();
        this.router.navigateByUrl('/');
      },
      error: () => this.submitting.set(false),
    });
  }
}
