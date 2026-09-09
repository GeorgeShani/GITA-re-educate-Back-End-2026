import {
  Component,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogRef } from '@angular/cdk/dialog';
import { ESCAPE, hasModifierKey } from '@angular/cdk/keycodes';

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
    <div #panelEl class="modal-dialog" [class.is-entered]="entered()">
      <header class="modal-dialog__header">
        @if (title(); as t) {
          <h2 class="modal-dialog__title">{{ t }}</h2>
        }
        <icon-button icon="x" ariaLabel="Close dialog" (clicked)="close()" />
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
  private readonly panelEl = viewChild<ElementRef<HTMLElement>>('panelEl');

  /**
   * Starts false so the browser paints the "before" frame once, then
   * flips true on the next render — same technique as the reveal
   * directive's pending/revealed split, just without the IntersectionObserver
   * since this only ever needs to fire once, right on mount.
   */
  protected readonly entered = signal(false);

  constructor() {
    afterNextRender(() => this.entered.set(true));

    /**
     * CdkDialogContainer owns the backdrop-click and Escape-key close
     * paths and, left alone, tears the overlay down the instant either
     * fires — bypassing the exit animation entirely. `disableClose` only
     * turns off DialogRef's own internal auto-close subscription; it
     * still forwards both streams unconditionally (DialogRef's
     * constructor in @angular/cdk/dialog sets
     * `this.backdropClick = overlayRef.backdropClick()` and
     * `this.keydownEvents = overlayRef.keydownEvents()` before checking
     * `disableClose` at all), so re-subscribing here and routing both
     * through the same animated close() as the button gives every close
     * path the same exit transition.
     */
    if (this.dialogRef) {
      this.dialogRef.disableClose = true;

      this.dialogRef.backdropClick
        .pipe(takeUntilDestroyed())
        .subscribe(() => this.close());

      this.dialogRef.keydownEvents.pipe(takeUntilDestroyed()).subscribe((event) => {
        // Same check CDK's own DialogRef makes internally, so Escape
        // keeps behaving identically (ignoring modified combos like
        // Cmd+Escape) once we take over closing it.
        if (event.keyCode === ESCAPE && !hasModifierKey(event)) {
          event.preventDefault();
          this.close();
        }
      });
    }
  }

  /**
   * Waits for the scale/fade-out transition to finish before actually
   * closing the CDK dialog — same transitionend-gated technique as
   * drawer-panel.ts's detach(), instead of tearing the DOM down
   * mid-animation. Now the single close path for the button, backdrop
   * click, and Escape alike (see constructor); `entered()` guards against
   * a second trigger (e.g. a stray extra Escape) re-running the teardown.
   */
  protected close(): void {
    if (!this.dialogRef || !this.entered()) return;

    this.entered.set(false);

    const element = this.panelEl()?.nativeElement;
    const finish = () => this.dialogRef?.close();

    if (element) {
      element.addEventListener('transitionend', finish, { once: true });
    } else {
      finish();
    }
  }
}
