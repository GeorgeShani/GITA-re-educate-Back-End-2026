import { Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';

import { AccountService } from '@/app/core/services/account.service';
import { AuthService } from '@/app/core/services/auth.service';
import { MediaService } from '@/app/core/services/media.service';
import { ToastService } from '@/app/core/services/toast.service';
import { firstSelectedFile, resetFileInput } from '@/app/core/util/dom-event';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { ImagePlaceholder } from '@/app/shared/ui/image-placeholder';
import { TextField } from '@/app/shared/ui/text-field';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'account-profile-page',
  imports: [FormField, RevealDirective, ActionButton, ImagePlaceholder, TextField],
  template: `
    <section reveal>
      <h1>Profile</h1>

      <div class="avatar-row">
        <image-placeholder
          [src]="auth.currentUser()?.avatarUrl"
          alt="Your avatar"
          [width]="80"
          [height]="80"
          class="avatar"
        />
        <div class="avatar-actions">
          <button type="button" class="upload-link" (click)="fileInputRef().nativeElement.click()">
            {{ uploading() ? 'Uploading...' : 'Change photo' }}
          </button>
          <input #fileInput type="file" accept="image/*" hidden (change)="onFileSelected($event)" />
          <p class="hint">JPG or PNG, up to 5 MB.</p>
        </div>
      </div>

      <form (submit)="onSubmit($event)" novalidate>
        <text-field
          label="First name"
          [height]="48"
          autocomplete="given-name"
          [formField]="profileForm.firstName"
        />
        <text-field
          label="Last name"
          [height]="48"
          autocomplete="family-name"
          [formField]="profileForm.lastName"
        />
        <text-field
          label="Phone (optional)"
          type="tel"
          [height]="48"
          autocomplete="tel"
          [formField]="profileForm.phone"
        />
        <text-field
          label="Email"
          type="email"
          [height]="48"
          [value]="auth.currentUser()?.email ?? ''"
          [disabled]="true"
          hint="Email can't be changed here."
        />

        <action-button type="submit" size="m" [loading]="saving()">Save changes</action-button>
      </form>
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    h1 {
      @include type.headline-6;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-07);
    }

    .avatar-row {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin-bottom: var(--space-8);
    }

    .avatar {
      flex-shrink: 0;
      width: 80px;
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .avatar-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .upload-link {
      @include type.caption-1-semi;
      align-self: start;
      color: var(--color-neutral-07);
      text-decoration: underline;
    }

    .hint {
      @include type.caption-2;
      margin: 0;
      color: var(--color-neutral-04);
    }

    form {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
      max-width: 26rem;
    }
  `,
})
export default class AccountProfile implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly account = inject(AccountService);
  private readonly media = inject(MediaService);
  private readonly toast = inject(ToastService);

  protected readonly fileInputRef = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);

  private readonly model = signal({ firstName: '', lastName: '', phone: '' });

  protected readonly profileForm = form(this.model, (f) => {
    required(f.firstName, { message: 'First name is required' });
    required(f.lastName, { message: 'Last name is required' });
  });

  ngOnInit(): void {
    this.auth.loadCurrentUser().subscribe({
      next: (user) => {
        this.model.set({
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone ?? '',
        });
      },
    });
  }

  protected onFileSelected(event: Event): void {
    const file = firstSelectedFile(event);
    resetFileInput(event);
    if (!file) return;

    if (file.size > MAX_AVATAR_BYTES) {
      this.toast.show('That image is too large — please choose one under 5 MB.', 'error');
      return;
    }

    this.uploading.set(true);
    this.media.upload(file, 'avatar').subscribe({
      next: (asset) => {
        this.account.updateProfile({ avatarUrl: asset.url }).subscribe({
          next: () => {
            // AccountService talks to /users/me directly — refresh
            // AuthService's shared signal so the header/shell greeting
            // (which read auth.currentUser(), not this page's own state)
            // pick up the new avatar too.
            this.auth.loadCurrentUser().subscribe();
            this.uploading.set(false);
            this.toast.show('Profile photo updated', 'success');
          },
          error: () => this.uploading.set(false),
        });
      },
      error: () => {
        this.uploading.set(false);
        this.toast.show('Could not upload that image. Please try again.', 'error');
      },
    });
  }

  protected onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.profileForm().markAsTouched();
    if (!this.profileForm().valid() || this.saving()) return;

    const { firstName, lastName, phone } = this.model();
    this.saving.set(true);
    this.account.updateProfile({ firstName, lastName, phone: phone || undefined }).subscribe({
      next: () => {
        this.auth.loadCurrentUser().subscribe();
        this.saving.set(false);
        this.toast.show('Profile updated', 'success');
      },
      error: () => this.saving.set(false),
    });
  }
}
