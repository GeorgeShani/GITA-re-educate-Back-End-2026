import { Component, ElementRef, output, viewChild } from '@angular/core';

/**
 * Scroll-snap based, not a JS carousel library — cheaper, and the mobile
 * designs are already overflow scrollers. Slide elements need their own
 * `scroll-snap-align: start` (product-card already sets it, harmlessly a
 * no-op outside a snap container) — carousel-track can't reach into
 * projected content's own encapsulated styles to add it for them.
 */
@Component({
  selector: 'carousel-track',
  template: `
    <div #scroller class="carousel-track" (scroll)="onScroll()">
      <ng-content />
    </div>
  `,
  styles: `
    .carousel-track {
      display: flex;
      gap: var(--space-4);
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scrollbar-width: none;
    }

    .carousel-track::-webkit-scrollbar {
      display: none;
    }
  `,
})
export class CarouselTrack {
  readonly activeChange = output<number>();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private scrollScheduled = false;

  protected onScroll(): void {
    if (this.scrollScheduled) return;
    this.scrollScheduled = true;

    requestAnimationFrame(() => {
      this.scrollScheduled = false;
      const element = this.scroller().nativeElement;
      const first = element.children[0];
      if (!(first instanceof HTMLElement)) return;

      const gap = parseFloat(getComputedStyle(element).columnGap || '0');
      const step = first.getBoundingClientRect().width + gap;
      if (step <= 0) return;

      this.activeChange.emit(Math.round(element.scrollLeft / step));
    });
  }

  scrollTo(index: number): void {
    const element = this.scroller().nativeElement;
    const target = element.children[index];
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
  }
}
