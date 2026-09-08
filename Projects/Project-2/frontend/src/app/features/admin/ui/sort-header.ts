import { Component, computed, input, output } from '@angular/core';

import { IconGlyph } from '@/app/shared/ui/icon-glyph';

export interface SortChange {
  field: string;
  direction: 'asc' | 'desc';
}

/** Clickable column-header label with a direction indicator — goes inside a caller's own <th>. */
@Component({
  selector: 'sort-header',
  imports: [IconGlyph],
  host: {
    '[class.is-active]': 'active()',
  },
  template: `
    <button type="button" (click)="toggle()">
      {{ label() }}
      @if (active()) {
        <icon-glyph
          name="chevron-down"
          [size]="14"
          class="indicator"
          [style.transform]="direction() === 'asc' ? 'rotate(180deg)' : 'none'"
        />
      }
    </button>
  `,
  styles: `
    button {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      color: inherit;
      cursor: pointer;
    }

    :host.is-active button {
      color: var(--color-neutral-07);
    }

    .indicator {
      transition: transform var(--duration-fast) var(--ease-out);
    }
  `,
})
export class SortHeader {
  readonly label = input.required<string>();
  readonly field = input.required<string>();
  readonly activeField = input<string>();
  readonly direction = input<'asc' | 'desc'>('asc');
  readonly sortChange = output<SortChange>();

  protected readonly active = computed(() => this.activeField() === this.field());

  protected toggle(): void {
    const nextDirection = this.active() && this.direction() === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ field: this.field(), direction: nextDirection });
  }
}
