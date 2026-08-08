import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

/**
 * Scroll-reveal animation, progressive-enhancement style.
 *
 * The host renders fully visible by default — in SSR output, with JS
 * disabled, and for the single frame before hydration completes. Only once
 * `afterNextRender` confirms we're in a real browser does the directive arm
 * itself (`reveal-pending` class) and start observing; the actual hidden
 * state (opacity/transform) lives in consumer CSS gated behind that class,
 * never in the directive itself. That ordering is what guarantees no-JS and
 * pre-hydration content is never blank — see verification step 3 in the
 * frontend plan.
 *
 * Usage:
 *   <section reveal>...</section>
 *   <section reveal [revealDelay]="150" [revealThreshold]="0.3" [revealOnce]="false">...</section>
 *
 * Staggering a list (e.g. product cards appearing one after another) —
 * pass the loop index and a per-item step instead of computing ms by hand:
 *   @for (product of products(); track product.id; let i = $index) {
 *     <product-card reveal [revealIndex]="i" [revealStagger]="60" .../>
 *   }
 * `revealDelay` and the stagger compose additively (effectiveDelay =
 * revealDelay + revealIndex * revealStagger), so a section can still open
 * with its own base delay before its children start staggering in.
 *
 * Consumer CSS:
 *   [reveal] { transition: opacity var(--duration-slow) var(--ease-out) var(--reveal-delay, 0ms),
 *                          transform var(--duration-slow) var(--ease-out) var(--reveal-delay, 0ms); }
 *   [reveal].reveal-pending { opacity: 0; transform: translateY(16px); }
 *   [reveal].is-revealed { opacity: 1; transform: none; }
 */
@Directive({
  selector: '[reveal]',
  host: {
    '[class.reveal-pending]': 'isPending()',
    '[class.is-revealed]': 'isRevealed()',
    '[style.--reveal-delay.ms]': 'effectiveDelay()',
  },
})
export class RevealDirective {
  /** Stop observing after the first reveal. Set false to re-hide on scroll-out. */
  readonly revealOnce = input(true);
  /** Fraction of the element that must be visible before it reveals. */
  readonly revealThreshold = input(0.15);
  /** Base transition delay in ms. */
  readonly revealDelay = input(0);
  /** Ms added per step of revealIndex — the stagger interval for a list. */
  readonly revealStagger = input(0);
  /** This item's position in a staggered group, typically @for's $index. */
  readonly revealIndex = input(0);

  /** Exposed as --reveal-delay; combines a base delay with index * stagger. */
  protected readonly effectiveDelay = computed(
    () => this.revealDelay() + this.revealIndex() * this.revealStagger(),
  );

  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isPending = signal(false);
  protected readonly isRevealed = signal(false);

  constructor() {
    afterNextRender(() => {
      if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) {
        // Skip the pending/hidden state entirely rather than animating with
        // durations neutralised to ~0 — the element should just be visible.
        this.isRevealed.set(true);
        return;
      }

      this.isPending.set(true);

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            this.isPending.set(false);
            this.isRevealed.set(true);
            if (this.revealOnce()) observer.disconnect();
          }
        },
        { threshold: this.revealThreshold() },
      );

      observer.observe(this.elementRef.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
