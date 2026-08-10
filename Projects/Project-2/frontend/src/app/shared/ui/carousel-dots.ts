import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'carousel-dots',
  host: {
    role: 'tablist',
    'aria-label': 'Slides',
  },
  template: `
    @for (i of dotIndexes(); track i) {
      <button
        type="button"
        class="carousel-dots__dot"
        role="tab"
        [class.is-active]="i === active()"
        [attr.aria-selected]="i === active()"
        [attr.aria-label]="'Go to slide ' + (i + 1)"
        (click)="activeChange.emit(i)"
      ></button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .carousel-dots__dot {
      width: 8px;
      height: 8px;
      padding: 0;
      border: none;
      border-radius: var(--radius-full);
      background: var(--color-neutral-03);
      transition:
        background-color var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out);
    }

    .carousel-dots__dot.is-active {
      background: var(--color-neutral-07);
      transform: scale(1.25);
    }
  `,
})
export class CarouselDots {
  readonly count = input.required<number>();
  readonly active = input(0);
  readonly activeChange = output<number>();

  protected readonly dotIndexes = computed(() =>
    Array.from({ length: this.count() }, (_, i) => i),
  );
}
