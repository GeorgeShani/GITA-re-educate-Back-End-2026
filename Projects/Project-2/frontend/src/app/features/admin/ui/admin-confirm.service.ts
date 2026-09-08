import { Dialog } from '@angular/cdk/dialog';
import { Service, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { AdminConfirmDialog, type AdminConfirmDialogData } from './admin-confirm-dialog';

/**
 * `confirmService.confirm({...}).subscribe(ok => if (ok) ...)` — every
 * destructive/state-changing admin action (ban, delete, approve, reject,
 * refund) goes through this instead of each page hand-rolling its own
 * dialog, same DRY reasoning as F8's account-settings.ts delete-confirm
 * but generalized to a service since 19 admin areas need this repeatedly.
 */
@Service()
export class AdminConfirmService {
  private readonly dialog = inject(Dialog);

  confirm(data: AdminConfirmDialogData): Observable<boolean> {
    const ref = this.dialog.open<boolean, AdminConfirmDialogData, AdminConfirmDialog>(AdminConfirmDialog, {
      data,
      panelClass: 'modal-overlay-pane',
    });
    return ref.closed.pipe(map((result) => result === true));
  }
}
