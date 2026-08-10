import { Component, computed, input, output } from '@angular/core';

import { IconGlyph } from './icon-glyph';

/**
 * Fill is monochrome (neutral-07 filled / neutral-03 empty) to match the
 * confirmed no-red, mostly-black-and-white palette. Not re-verified
 * against the Figma rating component specifically — swap the two color
 * rules below if the real design turns out to use a gold/amber fill.
 */
@Component({
  selector: 'rating-stars',
  imports: [IconGlyph],
  host: {
    '[attr.role]': "interactive() ? 'radiogroup' : 'img'",
    '[attr.aria-label]':
      "interactive() ? 'Rate out of ' + max() + ' stars' : (ariaLabel() ?? value() + ' out of ' + max() + ' stars')",
  },
  template: `
    <div class="stars">
      @for (i of starIndexes(); track i) {
        @if (interactive()) {
          <button
            type="button"
            class="star-slot"
            role="radio"
            [attr.aria-checked]="i < value()"
            [attr.aria-label]="i + 1 + (i === 0 ? ' star' : ' stars')"
            (click)="select(i)"
          >
            <icon-glyph name="star" [size]="16" class="star-empty" />
            <icon-glyph
              name="star"
              [size]="16"
              class="star-fill"
              [style.clip-path]="fillClip(i)"
            />
          </button>
        } @else {
          <span class="star-slot">
            <icon-glyph name="star" [size]="16" class="star-empty" />
            <icon-glyph
              name="star"
              [size]="16"
              class="star-fill"
              [style.clip-path]="fillClip(i)"
            />
          </span>
        }
      }
    </div>
    @if (count(); as c) {
      <span class="count">({{ c }})</span>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .stars {
      display: inline-flex;
      gap: 2px;
    }

    .star-slot {
      position: relative;
      display: inline-flex;
      background: none;
      border: none;
      padding: 0;
      margin: 0;
    }

    .star-empty {
      color: var(--color-neutral-03);
    }

    .star-fill {
      position: absolute;
      inset: 0;
      color: var(--color-neutral-07);
      transition: clip-path var(--duration-fast) var(--ease-out);
    }

    .count {
      @include type.caption-1;
      color: var(--color-neutral-04);
    }
  `,
})
export class RatingStars {
  readonly value = input(0);
  readonly max = input(5);
  readonly count = input<number>();
  readonly interactive = input(false);
  readonly ariaLabel = input<string>();
  readonly valueChange = output<number>();

  protected readonly starIndexes = computed(() =>
    Array.from({ length: this.max() }, (_, i) => i),
  );

  protected fillClip(i: number): string {
    const fill = Math.min(Math.max(this.value() - i, 0), 1);
    return `inset(0 ${100 - fill * 100}% 0 0)`;
  }

  protected select(i: number): void {
    this.valueChange.emit(i + 1);
  }
}
