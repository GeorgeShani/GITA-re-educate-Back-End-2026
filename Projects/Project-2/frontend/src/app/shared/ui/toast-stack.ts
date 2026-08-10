import {
  Component,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { Overlay } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

import { ToastService } from '@/app/core/services/toast.service';
import { IconButton } from './icon-button';

/**
 * Mount once at the app root (see app.html), like icon-sprite. The actual
 * screen-reader announcement comes from LiveAnnouncer inside ToastService
 * — this container is deliberately not an ARIA live region itself
 * (role="status"/"alert" are implicitly live too), so a toast isn't
 * announced twice.
 */
@Component({
  selector: 'toast-stack',
  imports: [IconButton],
  template: `
    <ng-template #panelTemplate>
      <div class="toast-stack">
        @for (toast of toastService.toasts(); track toast.id) {
          <div
            class="toast"
            [class]="toast.variant"
            [class.is-entering]="toast.entering"
            [class.is-leaving]="toast.leaving"
            (transitionend)="toast.leaving && toastService.remove(toast.id)"
          >
            <span class="toast__text">{{ toast.text }}</span>
            <icon-button icon="close" ariaLabel="Dismiss" (clicked)="toastService.dismiss(toast.id)" />
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    @use 'styles/typography' as type;

    .toast-stack {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 280px;
      max-width: 360px;
      padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      background: var(--color-neutral-07);
      color: var(--color-white);
      box-shadow: var(--shadow-depth-1);
      border-left: 3px solid var(--color-neutral-05);
      opacity: 1;
      transform: translateX(0);
      transition:
        opacity var(--duration-base) var(--ease-out),
        transform var(--duration-base) var(--ease-out);
    }

    .toast.is-entering,
    .toast.is-leaving {
      opacity: 0;
      transform: translateX(16px);
    }

    .toast.success {
      border-left-color: var(--color-success);
    }

    .toast.error {
      border-left-color: var(--color-error);
    }

    .toast__text {
      @include type.caption-1;
      flex: 1;
    }
  `,
})
export class ToastStack {
  protected readonly toastService = inject(ToastService);

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panelTemplate');

  constructor() {
    afterNextRender(() => {
      const overlayRef = this.overlay.create({
        positionStrategy: this.overlay.position().global().top('16px').right('16px'),
        panelClass: 'toast-overlay-pane',
      });
      overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    });
  }
}
