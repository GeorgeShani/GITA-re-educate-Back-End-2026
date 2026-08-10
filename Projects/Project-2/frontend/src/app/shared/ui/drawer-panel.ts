import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { CdkTrapFocus } from '@angular/cdk/a11y';

import { IconButton } from './icon-button';

/**
 * Slide-in panel from an edge — cart flyout, mobile menu. Built on raw
 * Overlay (not the Dialog service), so unlike modal-dialog this wires its
 * own focus trap (CdkTrapFocus) and focus restoration by hand.
 *
 * `<ng-content>` lives inside an <ng-template>, portaled into the overlay
 * only while `open()` is true — the projected content is still captured
 * from wherever <drawer-panel> is used, template-wrapping just defers
 * *when* it renders. Same technique Angular Material's own overlay-backed
 * components use.
 */
@Component({
  selector: 'drawer-panel',
  imports: [CdkTrapFocus, IconButton],
  template: `
    <ng-template #panelTemplate>
      <div
        #panelEl
        class="drawer-panel"
        [class.side-left]="side() === 'left'"
        [class.is-entered]="entered()"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
      >
        <icon-button
          icon="close"
          ariaLabel="Close"
          class="drawer-panel__close"
          (clicked)="requestClose()"
        />
        <div class="drawer-panel__body">
          <ng-content />
        </div>
      </div>
    </ng-template>
  `,
  styles: `
    .drawer-panel {
      display: flex;
      flex-direction: column;
      width: min(400px, 100vw);
      height: 100%;
      padding: var(--space-6);
      background: var(--color-white);
      box-shadow: var(--shadow-depth-1);
      transform: translateX(100%);
      transition: transform var(--duration-base) var(--ease-out);
    }

    .drawer-panel.side-left {
      transform: translateX(-100%);
    }

    .drawer-panel.is-entered {
      transform: translateX(0);
    }

    .drawer-panel__close {
      align-self: flex-end;
    }

    .drawer-panel__body {
      flex: 1;
      overflow-y: auto;
    }
  `,
})
export class DrawerPanel {
  readonly open = input(false);
  readonly side = input<'left' | 'right'>('right');
  readonly openChange = output<boolean>();

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panelTemplate');
  private readonly panelEl = viewChild<ElementRef<HTMLElement>>('panelEl');

  protected readonly entered = signal(false);

  private overlayRef: OverlayRef | null = null;
  private lastFocusedElement: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (this.open()) this.attach();
      else this.detach();
    });
    this.destroyRef.onDestroy(() => this.overlayRef?.dispose());
  }

  protected requestClose(): void {
    this.openChange.emit(false);
  }

  private attach(): void {
    if (typeof window === 'undefined') return;

    if (!this.overlayRef) {
      const positionStrategy = this.overlay.position().global().top('0');
      this.overlayRef = this.overlay.create({
        positionStrategy: this.side() === 'left' ? positionStrategy.left('0') : positionStrategy.right('0'),
        hasBackdrop: true,
        backdropClass: 'cdk-overlay-dark-backdrop',
        panelClass: 'drawer-overlay-pane',
        scrollStrategy: this.overlay.scrollStrategies.block(),
        height: '100%',
      });
      this.overlayRef.backdropClick().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.requestClose());
      this.overlayRef
        .keydownEvents()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => {
          if (event.key === 'Escape') this.requestClose();
        });
    }

    if (this.overlayRef.hasAttached()) return;
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
    this.overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    afterNextRender(() => this.entered.set(true), { injector: this.injector });
  }

  /**
   * Waits for the slide-out transition to actually finish before detaching
   * — detaching immediately would remove the panel from the DOM before it
   * had any chance to animate out. transitionend still fires reliably
   * under the global prefers-reduced-motion backstop (0.01ms is a
   * non-zero duration), so this degrades to a near-instant close there.
   */
  private detach(): void {
    if (!this.overlayRef?.hasAttached()) return;
    this.entered.set(false);

    const element = this.panelEl()?.nativeElement;
    const finish = () => {
      this.overlayRef?.detach();
      this.lastFocusedElement?.focus();
    };

    if (element) {
      element.addEventListener('transitionend', finish, { once: true });
    } else {
      finish();
    }
  }
}
