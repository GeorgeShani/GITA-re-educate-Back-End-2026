import { Dialog } from '@angular/cdk/dialog';
import { Component, OnInit, TemplateRef, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { AccountService } from '@/app/core/services/account.service';
import { AuthService } from '@/app/core/services/auth.service';
import { ToastService } from '@/app/core/services/toast.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { CheckboxField } from '@/app/shared/ui/checkbox-field';
import { ModalDialog } from '@/app/shared/ui/modal-dialog';

@Component({
  selector: 'account-settings-page',
  imports: [RevealDirective, ActionButton, CheckboxField, ModalDialog],
  template: `
    <section reveal>
      <h1>Settings</h1>

      <div class="block">
        <h2>Email notifications</h2>
        <p class="hint">Order confirmations, security, and account notices are always sent.</p>
        <label class="pref">
          <checkbox-field [checked]="marketingOptIn()" (checkedChange)="onMarketingToggle($event)" />
          News, deals, and product updates
        </label>
      </div>

      <div class="block">
        <h2>Your data</h2>
        <p class="hint">Download a copy of the personal data we hold about your account.</p>
        <action-button size="s" variant="secondary" [loading]="exporting()" (click)="onExport()">
          Export my data
        </action-button>
      </div>

      <div class="block">
        <h2>Delete account</h2>
        <p class="hint">
          Permanently anonymizes your account. Orders and reviews are kept as historical records but
          are no longer linked to you.
        </p>
        <button type="button" class="delete-btn" (click)="openDeleteConfirm()">
          Delete my account
        </button>
      </div>

      <ng-template #deleteConfirmTemplate>
        <modal-dialog title="Delete your account?">
          <p class="modal-copy">
            This can't be undone. Your profile will be permanently anonymized and you'll be signed out.
          </p>
          <div footer class="modal-actions">
            <action-button variant="ghost" size="s" (click)="closeDeleteConfirm()">Cancel</action-button>
            <action-button size="s" [loading]="deleting()" (click)="onDelete()">
              Yes, delete my account
            </action-button>
          </div>
        </modal-dialog>
      </ng-template>
    </section>
  `,
  styles: `
    @use 'styles/typography' as type;

    h1 {
      @include type.headline-6;
      margin: 0 0 var(--space-8);
      color: var(--color-neutral-07);
    }

    .block {
      max-width: 30rem;
      margin-bottom: var(--space-8);
    }

    h2 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .hint {
      @include type.caption-1;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-04);
    }

    .pref {
      @include type.body-2;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-neutral-06);
    }

    .delete-btn {
      @include type.button-s;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      padding: 6px var(--space-6);
      border-radius: var(--radius-lg);
      box-shadow: inset 0 0 0 1px var(--color-error);
      color: var(--color-error);
      transition: background-color var(--duration-fast) var(--ease-out);

      &:hover {
        background: color-mix(in srgb, var(--color-error) 8%, transparent);
      }

      &:active {
        transform: scale(0.97);
      }
    }

    .modal-copy {
      @include type.body-2;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-06);
    }

    .modal-actions {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }

  `,
})
export default class AccountSettings implements OnInit {
  private readonly account = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);

  private readonly deleteConfirmTemplate =
    viewChild.required<TemplateRef<unknown>>('deleteConfirmTemplate');

  protected readonly marketingOptIn = signal(false);
  protected readonly exporting = signal(false);
  protected readonly deleting = signal(false);

  ngOnInit(): void {
    this.account.getNotificationPreferences().subscribe((prefs) => {
      this.marketingOptIn.set(prefs.optedInCategories.includes('marketing'));
    });
  }

  protected onMarketingToggle(value: boolean): void {
    this.marketingOptIn.set(value);
    this.account.updateNotificationPreferences(value).subscribe({
      error: () => this.marketingOptIn.set(!value),
    });
  }

  protected onExport(): void {
    this.exporting.set(true);
    this.account.exportData().subscribe({
      next: (data) => {
        this.exporting.set(false);
        this.downloadJson(data, `account-export-${new Date().toISOString().slice(0, 10)}.json`);
      },
      error: () => this.exporting.set(false),
    });
  }

  private downloadJson(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected openDeleteConfirm(): void {
    this.dialog.open(this.deleteConfirmTemplate(), { panelClass: 'modal-overlay-pane' });
  }

  protected closeDeleteConfirm(): void {
    this.dialog.closeAll();
  }

  protected onDelete(): void {
    this.deleting.set(true);
    this.account.deleteAccount().subscribe({
      next: () => {
        this.dialog.closeAll();
        this.auth.clearSession();
        this.toast.show('Your account has been deleted', 'success');
        void this.router.navigateByUrl('/');
      },
      error: () => this.deleting.set(false),
    });
  }
}
