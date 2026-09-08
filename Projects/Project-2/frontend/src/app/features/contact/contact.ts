import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';

import { ContactService } from '@/app/core/services/contact.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';

interface ContactFormModel {
  name: string;
  email: string;
  subject: string;
  message: string;
}

@Component({
  selector: 'contact-page',
  imports: [RevealDirective, ActionButton, FormField, PageContainer, PageSection],
  template: `
    <page-section spacing="md">
      <page-container>
        <div class="layout">
          <header class="head" reveal>
            <h1>Get in touch</h1>
            <p class="subhead">
              Questions about an order, a product, or anything else — send us a message and we'll get back
              to you as soon as we can.
            </p>
          </header>

          <div class="form-wrap" reveal>
            @if (submitted()) {
              <p class="confirmation" role="status">
                Thanks — your message has been sent. We'll reply to {{ model().email }} soon.
              </p>
            } @else {
              <form (submit)="onSubmit($event)" novalidate>
                <div class="row">
                  <div class="field">
                    <label for="name">Name</label>
                    <input id="name" type="text" autocomplete="name" [formField]="contactForm.name" />
                    @if (contactForm.name().touched() && contactForm.name().errors()[0]; as err) {
                      <p class="error">{{ err.message }}</p>
                    }
                  </div>
                  <div class="field">
                    <label for="email">Email</label>
                    <input id="email" type="email" autocomplete="email" [formField]="contactForm.email" />
                    @if (contactForm.email().touched() && contactForm.email().errors()[0]; as err) {
                      <p class="error">{{ err.message }}</p>
                    }
                  </div>
                </div>

                <div class="field">
                  <label for="subject">Subject (optional)</label>
                  <input id="subject" type="text" [formField]="contactForm.subject" />
                </div>

                <div class="field">
                  <label for="message">Message</label>
                  <textarea id="message" rows="6" [formField]="contactForm.message"></textarea>
                  @if (contactForm.message().touched() && contactForm.message().errors()[0]; as err) {
                    <p class="error">{{ err.message }}</p>
                  }
                </div>

                <action-button type="submit" size="m" [loading]="submitting()">Send message</action-button>
              </form>
            }
          </div>
        </div>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .layout {
      display: grid;
      gap: var(--space-10);
      max-width: 40rem;
      margin: 0 auto;
    }

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-3);
      color: var(--color-neutral-07);
    }

    .subhead {
      @include type.body-2;
      margin: 0;
      color: var(--color-neutral-04);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .row {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--space-4);

      @include bp.tablet-up {
        grid-template-columns: 1fr 1fr;
      }
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

    input,
    textarea {
      @include type.body-2;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-border-input);
      color: var(--color-neutral-07);
      resize: vertical;

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

    .confirmation {
      @include type.body-2;
      color: var(--color-success);
    }
  `,
})
export default class Contact {
  private readonly contact = inject(ContactService);

  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);

  protected readonly model = signal<ContactFormModel>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  protected readonly contactForm = form(this.model, (f) => {
    required(f.name, { message: 'Name is required' });
    required(f.email, { message: 'Email is required' });
    email(f.email, { message: 'Enter a valid email address' });
    required(f.message, { message: 'Message cannot be empty' });
  });

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.contactForm().markAsTouched();
    if (!this.contactForm().valid() || this.submitting()) return;

    this.submitting.set(true);
    const input = this.model();
    this.contact
      .submit({
        name: input.name,
        email: input.email,
        subject: input.subject || undefined,
        message: input.message,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.submitted.set(true);
        },
        error: () => this.submitting.set(false),
      });
  }
}
