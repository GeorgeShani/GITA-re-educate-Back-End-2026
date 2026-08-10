import { Component, ElementRef, input, output, viewChildren } from '@angular/core';

import { ImagePlaceholder } from './image-placeholder';

export interface SwatchOption {
  readonly value: string;
  readonly label: string;
  readonly image?: string;
  readonly color?: string;
}

/**
 * Roving tabindex: only the selected (or first) swatch is in the tab
 * order; arrow keys move both focus and selection among the rest. CDK's
 * ListKeyManager would do this too, but swatch-picker is Tier 2 — CDK is
 * reserved for Tier 3, so this is hand-rolled.
 */
@Component({
  selector: 'swatch-picker',
  imports: [ImagePlaceholder],
  host: {
    role: 'radiogroup',
  },
  template: `
    @for (option of options(); track option.value; let i = $index) {
      <button
        #swatchButton
        type="button"
        class="swatch"
        role="radio"
        [attr.aria-checked]="option.value === value()"
        [attr.aria-label]="option.label"
        [attr.tabindex]="tabIndexFor(i)"
        [style.background]="option.color ?? null"
        (click)="select(option.value)"
        (keydown)="onKeydown($event, i)"
      >
        @if (option.image; as img) {
          <image-placeholder [src]="img" [alt]="option.label" [width]="32" [height]="32" />
        }
      </button>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      gap: var(--space-2);
    }

    .swatch {
      width: 32px;
      height: 32px;
      padding: 2px;
      border: 1px solid var(--color-border-input);
      border-radius: var(--radius-full);
      overflow: hidden;
      cursor: pointer;
      outline: 2px solid transparent;
      outline-offset: 2px;
      transition: outline-color var(--duration-fast) var(--ease-out);
    }

    .swatch[aria-checked='true'] {
      outline-color: var(--color-neutral-07);
    }
  `,
})
export class SwatchPicker {
  readonly options = input.required<SwatchOption[]>();
  readonly value = input<string>();
  readonly valueChange = output<string>();

  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('swatchButton');

  protected tabIndexFor(index: number): number {
    const options = this.options();
    const selectedIndex = options.findIndex((o) => o.value === this.value());
    const activeIndex = selectedIndex === -1 ? 0 : selectedIndex;
    return index === activeIndex ? 0 : -1;
  }

  protected select(value: string): void {
    this.valueChange.emit(value);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const options = this.options();
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length;
    }

    if (nextIndex === null) return;
    event.preventDefault();

    const option = options[nextIndex];
    if (!option) return;
    this.select(option.value);
    this.buttons()[nextIndex]?.nativeElement.focus();
  }
}
