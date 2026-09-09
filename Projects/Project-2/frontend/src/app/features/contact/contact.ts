import { Component, inject, signal } from '@angular/core';
import { FormField, email, form, required } from '@angular/forms/signals';

import { ContactService } from '@/app/core/services/contact.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { TextField } from '@/app/shared/ui/text-field';
import { TextareaField } from '@/app/shared/ui/textarea-field';

interface ContactFormModel {
  name: string;
  email: string;
  subject: string;
  message: string;
}

@Component({
  selector: 'contact-page',
  imports: [RevealDirective, ActionButton, FormField, PageContainer, PageSection, TextField, TextareaField],
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
                  <text-field
                    label="Name"
                    [height]="48"
                    autocomplete="name"
                    [formField]="contactForm.name"
                  />
                  <text-field
                    label="Email"
                    type="email"
                    [height]="48"
                    autocomplete="email"
                    [formField]="contactForm.email"
                  />
                </div>

                <text-field label="Subject (optional)" [height]="48" [formField]="contactForm.subject" />

                <textarea-field label="Message" [formField]="contactForm.message" />

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
