import { Component, afterNextRender, inject, input, signal } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';

import { IconButton } from './icon-button';

/**
 * Chrome only — title/close/body/footer. Use as the content passed to
 * Dialog.open() (component or TemplateRef both work), or nest it inside a
 * consumer's own dialog-content component. Either way DialogRef resolves
 * via Angular's hierarchical injector, since CdkDialogContainer provides
 * it to the whole subtree it renders — no need to pass it down manually.
 *
 * Focus trapping/restoration and aria-modal/role are NOT this component's
 * job: Dialog.open() already wires those through CdkDialogContainer.
 * This is purely the visual shell — see SCOPE.md Open Items, the panel
 * chrome/colors below aren't in the Figma file either.
 */
@Component({
  selector: 'modal-dialog',
  imports: [IconButton],
  template: `
    <div class="modal-dialog" [class.is-entered]="entered()">
      <header class="modal-dialog__header">
        @if (title(); as t) {
          <h2 class="modal-dialog__title">{{ t }}</h2>
        }
        <icon-button icon="close" ariaLabel="Close dialog" (clicked)="close()" />
      </header>
      <div class="modal-dialog__body">
        <ng-content />
      </div>
      <ng-content select="[footer]" />
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    .modal-dialog {
      display: flex;
      flex-direction: column;
      min-width: 320px;
      max-width: 480px;
      padding: var(--space-6);
      border-radius: var(--radius-lg);
      background: var(--color-white);
      box-shadow: var(--shadow-depth-1);
      opacity: 0;
      transform: scale(0.96);
      transition:
        opacity var(--duration-base) var(--ease-out),
        transform var(--duration-base) var(--ease-out);
    }

    .modal-dialog.is-entered {
      opacity: 1;
      transform: scale(1);
    }

    .modal-dialog__header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      margin-bottom: var(--space-4);
    }

    .modal-dialog__title {
      @include type.headline-6;
    }

    .modal-dialog__body {
      @include type.body-2;
      color: var(--color-neutral-06);
    }
  `,
})
export class ModalDialog {
  readonly title = input<string>();

  private readonly dialogRef = inject(DialogRef, { optional: true });

  /**
   * Starts false so the browser paints the "before" frame once, then
   * flips true on the next render — same technique as the reveal
   * directive's pending/revealed split, just without the IntersectionObserver
   * since this only ever needs to fire once, right on mount.
   */
  protected readonly entered = signal(false);

  constructor() {
    afterNextRender(() => this.entered.set(true));
  }

  protected close(): void {
    this.dialogRef?.close();
  }
}
