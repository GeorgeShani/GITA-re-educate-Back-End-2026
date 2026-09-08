import { NgOptimizedImage } from '@angular/common';
import { Component, computed, input, signal } from '@angular/core';

import type { ProductImageDto } from '@/app/core/api/dto';
import { IconButton } from '@/app/shared/ui/icon-button';

/**
 * Featured image + thumbnail rail. Most seeded products currently have a
 * single photo — the arrows and thumbnail row simply don't render then,
 * rather than showing controls with nothing to navigate to.
 */
@Component({
  selector: 'product-gallery',
  imports: [NgOptimizedImage, IconButton],
  template: `
    <div class="featured">
      @if (activeImage(); as image) {
        <img [ngSrc]="image.url" [alt]="image.alt" fill priority />
      }
      @if (images().length > 1) {
        <icon-button
          icon="chevron-left"
          ariaLabel="Previous photo"
          class="arrow arrow--prev"
          (clicked)="step(-1)"
        />
        <icon-button
          icon="chevron-right"
          ariaLabel="Next photo"
          class="arrow arrow--next"
          (clicked)="step(1)"
        />
      }
    </div>
    @if (images().length > 1) {
      <ul class="thumbs" role="list">
        @for (image of images(); track image._id; let i = $index) {
          <li>
            <button
              type="button"
              class="thumb"
              [class.is-active]="i === activeIndex()"
              [attr.aria-label]="'Show photo ' + (i + 1) + ' of ' + images().length"
              [attr.aria-pressed]="i === activeIndex()"
              (click)="activeIndex.set(i)"
            >
              <img [ngSrc]="image.url" [alt]="''" fill />
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .featured {
      position: relative;
      aspect-ratio: 547 / 728;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-neutral-02);

      img {
        object-fit: cover;
        mix-blend-mode: multiply;
      }
    }

    .arrow {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      background: var(--color-white);
      box-shadow: var(--shadow-depth-1);
      border-radius: var(--radius-full);
    }

    .arrow--prev {
      left: var(--space-4);
    }

    .arrow--next {
      right: var(--space-4);
    }

    .thumbs {
      display: flex;
      gap: var(--space-3);
      margin: var(--space-4) 0 0;
      padding: 0;
      list-style: none;
    }

    .thumb {
      position: relative;
      width: 72px;
      aspect-ratio: 1;
      border-radius: var(--radius-md);
      overflow: hidden;
      background: var(--color-neutral-02);
      outline: 2px solid transparent;
      outline-offset: 2px;
      transition: outline-color var(--duration-fast) var(--ease-out);

      img {
        object-fit: cover;
        mix-blend-mode: multiply;
      }

      &.is-active {
        outline-color: var(--color-neutral-07);
      }
    }
  `,
})
export class ProductGallery {
  readonly images = input.required<ProductImageDto[]>();

  protected readonly activeIndex = signal(0);

  protected readonly activeImage = computed(
    () => this.images()[this.activeIndex()] ?? this.images()[0],
  );

  protected step(delta: 1 | -1): void {
    const count = this.images().length;
    this.activeIndex.update((i) => (i + delta + count) % count);
  }
}
