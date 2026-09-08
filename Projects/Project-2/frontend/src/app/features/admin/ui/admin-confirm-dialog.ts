import { Component, inject } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

import { ActionButton } from '@/app/shared/ui/action-button';
import { ModalDialog } from '@/app/shared/ui/modal-dialog';

export interface AdminConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
}

/** Opened via AdminConfirmService — never directly with Dialog.open(). */
@Component({
  selector: 'admin-confirm-dialog',
  imports: [ModalDialog, ActionButton],
  template: `
    <modal-dialog [title]="data.title">
      <p>{{ data.message }}</p>
      <div footer class="actions">
        <action-button variant="ghost" size="s" (click)="dialogRef.close(false)">Cancel</action-button>
        <action-button size="s" (click)="dialogRef.close(true)">{{ data.confirmLabel ?? 'Confirm' }}</action-button>
      </div>
    </modal-dialog>
  `,
  styles: `
    .actions {
      display: flex;
      align-items: center;
      gap: var(--space-4);
    }
  `,
})
export class AdminConfirmDialog {
  protected readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  protected readonly data = inject<AdminConfirmDialogData>(DIALOG_DATA);
}
