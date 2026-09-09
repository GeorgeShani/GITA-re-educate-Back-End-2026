import {
  Component,
  ComponentRef,
  Directive,
  ElementRef,
  DestroyRef,
  Injector,
  ViewContainerRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { AriaDescriber } from '@angular/cdk/a11y';

/** Internal — the floating panel tooltip-hint portals in. Not meant to be used directly. */
@Component({
  selector: 'tooltip-panel',
  host: {
    '[class.is-entered]': 'entered()',
  },
  template: `{{ text() }}`,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
      max-width: 240px;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--color-neutral-07);
      color: var(--color-white);
      @include type.caption-2;
      opacity: 0;
      transform: translateY(4px);
      transition:
        opacity var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out);
    }

    :host.is-entered {
      opacity: 1;
      transform: translateY(0);
    }
  `,
})
export class TooltipPanel {
  readonly text = signal('');
  readonly entered = signal(false);
}

/**
 * Attribute directive: `<button tooltipHint="Add to wishlist">`. Shows a
 * small overlay on hover/focus; also registers the text via AriaDescriber
 * (aria-describedby) so it's accessible independent of hover/focus timing
 * — CDK's tool for exactly this, rather than hand-rolling the attribute
 * wiring and dedup logic ourselves.
 *
 * The description is registered once via afterNextRender using the value
 * at that point, not kept in sync with later input changes — tooltip text
 * changing at runtime is an edge case not worth the added complexity of
 * tracking/removing the previous description on every change.
 */
@Directive({
  selector: '[tooltipHint]',
  host: {
    '(mouseenter)': 'onPointerEnter()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
  },
})
export class TooltipHint {
  readonly tooltipHint = input.required<string>();
  readonly tooltipPosition = input<'top' | 'bottom'>('top');

  private readonly overlay = inject(Overlay);
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly ariaDescriber = inject(AriaDescriber);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly injector = inject(Injector);

  private overlayRef: OverlayRef | null = null;
  private panelRef: ComponentRef<TooltipPanel> | null = null;

  /**
   * Touch browsers fire a synthetic mouseenter on tap (to simulate hover
   * for sites that need it) but typically never a matching mouseleave —
   * nothing else touches this element to trigger one — so gating the
   * mouseenter path to genuine hover-capable pointers keeps the tooltip
   * from getting stuck open after a tap. Same media query already used
   * to guard bare `:hover` in CSS across shared/ui; focus/blur (below)
   * stay ungated so keyboard and screen-reader users are unaffected.
   */
  private readonly canHover =
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  constructor() {
    afterNextRender(() => {
      this.ariaDescriber.describe(this.elementRef.nativeElement, this.tooltipHint());
    });

    inject(DestroyRef).onDestroy(() => {
      this.overlayRef?.dispose();
      this.ariaDescriber.removeDescription(this.elementRef.nativeElement, this.tooltipHint());
    });
  }

  protected onPointerEnter(): void {
    if (this.canHover) this.show();
  }

  protected show(): void {
    if (typeof window === 'undefined' || this.overlayRef?.hasAttached()) return;

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.elementRef)
      .withPositions(
        this.tooltipPosition() === 'top'
          ? [
              {
                originX: 'center',
                originY: 'top',
                overlayX: 'center',
                overlayY: 'bottom',
                offsetY: -8,
              },
            ]
          : [
              {
                originX: 'center',
                originY: 'bottom',
                overlayX: 'center',
                overlayY: 'top',
                offsetY: 8,
              },
            ],
      );

    this.overlayRef ??= this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      panelClass: 'dropdown-overlay-pane',
    });
    this.overlayRef.updatePositionStrategy(positionStrategy);

    const portal = new ComponentPortal(TooltipPanel, this.viewContainerRef, this.injector);
    const ref = this.overlayRef.attach(portal);
    this.panelRef = ref;
    ref.instance.text.set(this.tooltipHint());
    afterNextRender(() => ref.instance.entered.set(true), { injector: this.injector });
  }

  /**
   * Waits for the fade-out transition to finish before detaching — same
   * technique as drawer-panel.ts's detach(): a real `transitionend`
   * listener, not a fixed setTimeout, so this stays correct regardless of
   * the actual duration (including under prefers-reduced-motion, where
   * transitions are neutralised to ~0 rather than removed outright).
   */
  protected hide(): void {
    if (!this.overlayRef?.hasAttached()) return;

    const panelRef = this.panelRef;
    panelRef?.instance.entered.set(false);

    // ComponentRef.location.nativeElement is `any` by Angular's own types
    // (ElementRef<T> defaults T to any) — narrow it for real rather than
    // asserting past what's actually known.
    const nativeElement: unknown = panelRef?.location.nativeElement;
    const element = nativeElement instanceof HTMLElement ? nativeElement : undefined;
    const finish = () => this.overlayRef?.detach();

    if (element) {
      element.addEventListener('transitionend', finish, { once: true });
    } else {
      finish();
    }
  }
}
