import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';

import { CatalogService } from '@/app/core/services/catalog.service';
import { SearchHistoryService } from '@/app/core/services/search-history.service';
import { inputValue } from '@/app/core/util/dom-event';
import { IconGlyph } from '@/app/shared/ui/icon-glyph';

const MIN_TYPEAHEAD_LENGTH = 2;

interface Suggestion {
  readonly label: string;
  readonly kind: 'suggestion' | 'recent';
}

/**
 * The storefront search field: a real `<input role="combobox">` with a
 * listbox of live typeahead suggestions (and the shopper's recent
 * searches when it's empty). Follows the ARIA combobox pattern — DOM
 * focus stays in the input, `aria-activedescendant` points at the
 * highlighted option, arrow keys move it, Enter submits.
 *
 * Owns no URL state: it emits `(search)` with the chosen term and lets
 * the page decide what to do (navigate to `/search?q=…`).
 */
@Component({
  selector: 'search-box',
  imports: [IconGlyph],
  host: { class: 'search-box' },
  template: `
    <div class="wrap" (focusout)="onFocusOut($event)">
      <span class="lead" aria-hidden="true">
        <icon-glyph name="search" [size]="20" />
      </span>

      <input
        #inputEl
        type="search"
        role="combobox"
        autocomplete="off"
        aria-autocomplete="list"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-controls]="listboxId"
        [attr.aria-activedescendant]="activeId()"
        [placeholder]="placeholder()"
        [value]="draft()"
        (input)="onInput($event)"
        (focus)="open()"
        (keydown)="onKeydown($event)"
      />

      @if (draft()) {
        <button type="button" class="clear" aria-label="Clear search" (click)="clear()">
          <icon-glyph name="x" [size]="18" />
        </button>
      }

      @if (isOpen() && options().length) {
        <ul [id]="listboxId" class="listbox" role="listbox" [attr.aria-label]="listboxLabel()">
          @for (option of options(); track option.kind + option.label; let i = $index) {
            <li
              #optionEl
              [id]="optionId(i)"
              role="option"
              class="option"
              [class.is-active]="i === activeIndex()"
              [attr.aria-selected]="i === activeIndex()"
              (mousedown)="$event.preventDefault()"
              (click)="choose(option)"
            >
              <icon-glyph name="search" [size]="16" class="option-icon" />
              <span class="option-label">{{ option.label }}</span>
              @if (option.kind === 'recent') {
                <span class="option-tag">Recent</span>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    .wrap {
      position: relative;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      height: var(--search-box-height, 52px);
      padding: 0 var(--space-3) 0 var(--space-4);
      border-radius: var(--radius-full);
      background: var(--color-white);
      box-shadow: inset 0 0 0 1px var(--color-border-input);
      transition: box-shadow var(--duration-fast) var(--ease-out);
    }

    .wrap:focus-within {
      box-shadow: inset 0 0 0 1px var(--color-info), 0 0 0 4px color-mix(in srgb, var(--color-info) 14%, transparent);
    }

    .lead {
      display: grid;
      place-items: center;
      color: var(--color-neutral-04);
    }

    input {
      @include type.body-1;
      flex: 1;
      min-width: 0;
      height: 100%;
      border: none;
      background: none;
      outline: none;
      color: var(--color-neutral-07);
    }

    input::placeholder {
      color: var(--color-neutral-04);
    }

    // Kill the native search-field decorations — we render our own clear button.
    input::-webkit-search-cancel-button,
    input::-webkit-search-decoration {
      appearance: none;
    }

    .clear {
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: var(--radius-full);
      background: var(--color-neutral-02);
      color: var(--color-neutral-05);
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-out);
    }

    @media (hover: hover) and (pointer: fine) {
      .clear:hover {
        background: var(--color-neutral-03);
      }
    }

    .listbox {
      position: absolute;
      top: calc(100% + var(--space-2));
      left: 0;
      right: 0;
      z-index: var(--z-dropdown);
      max-height: 320px;
      overflow-y: auto;
      margin: 0;
      padding: var(--space-2);
      list-style: none;
      border-radius: var(--radius-lg);
      background: var(--color-white);
      box-shadow: var(--shadow-depth-1);
    }

    .option {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius-md);
      color: var(--color-neutral-06);
      cursor: pointer;
    }

    .option-icon {
      flex-shrink: 0;
      color: var(--color-neutral-04);
    }

    .option-label {
      @include type.body-2;
      flex: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .option-tag {
      @include type.caption-2;
      flex-shrink: 0;
      color: var(--color-neutral-04);
    }

    .option.is-active {
      background: var(--color-neutral-02);
      color: var(--color-neutral-07);
    }
  `,
})
export class SearchBox {
  /** Seeds the field, e.g. from the URL's `?q=` on a full-page load. */
  readonly initialValue = input('');
  readonly placeholder = input('Search for products, brands, and more');
  readonly ariaLabel = input('Search the store');
  readonly search = output<string>();

  private readonly catalog = inject(CatalogService);
  private readonly history = inject(SearchHistoryService);
  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('inputEl');
  private readonly optionEls = viewChildren<ElementRef<HTMLLIElement>>('optionEl');

  private static nextId = 0;
  protected readonly listboxId = `search-box-listbox-${SearchBox.nextId++}`;

  protected readonly draft = signal('');
  protected readonly isOpen = signal(false);
  protected readonly activeIndex = signal(-1);

  private readonly typeahead = toSignal(
    toObservable(this.draft).pipe(
      debounceTime(180),
      distinctUntilChanged(),
      switchMap((term) =>
        term.trim().length >= MIN_TYPEAHEAD_LENGTH
          ? this.catalog.typeahead(term.trim()).pipe(catchError(() => of<string[]>([])))
          : of<string[]>([]),
      ),
    ),
    { initialValue: [] as string[] },
  );

  protected readonly options = computed<Suggestion[]>(() => {
    const term = this.draft().trim();
    if (term.length >= MIN_TYPEAHEAD_LENGTH) {
      return this.typeahead()
        .filter((label) => label.toLowerCase() !== term.toLowerCase())
        .map((label) => ({ label, kind: 'suggestion' as const }));
    }
    return this.history.terms().map((label) => ({ label, kind: 'recent' as const }));
  });

  protected readonly activeId = computed(() =>
    this.activeIndex() >= 0 ? this.optionId(this.activeIndex()) : null,
  );

  protected optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  protected readonly listboxLabel = computed(() =>
    this.draft().trim().length >= MIN_TYPEAHEAD_LENGTH ? 'Suggestions' : 'Recent searches',
  );

  constructor() {
    effect(() => this.draft.set(this.initialValue()));
    // Any change to the option set invalidates the highlighted index.
    effect(() => {
      this.options();
      this.activeIndex.set(-1);
    });
    // Keep the highlighted option visible as arrow keys move it past the
    // edge of the scrollable listbox.
    effect(() => {
      const index = this.activeIndex();
      if (index < 0) return;
      this.optionEls()[index]?.nativeElement.scrollIntoView({ block: 'nearest' });
    });
  }

  protected onInput(event: Event): void {
    this.draft.set(inputValue(event));
    this.isOpen.set(true);
  }

  protected open(): void {
    this.isOpen.set(true);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget;
    const wrap = this.inputEl().nativeElement.closest('.wrap');
    if (next instanceof Node && wrap?.contains(next)) return;
    this.isOpen.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const count = this.options().length;

    switch (event.key) {
      case 'ArrowDown':
        if (!this.isOpen()) {
          this.isOpen.set(true);
          return;
        }
        if (count) {
          event.preventDefault();
          this.activeIndex.set((this.activeIndex() + 1) % count);
        }
        return;
      case 'ArrowUp':
        if (count) {
          event.preventDefault();
          this.activeIndex.set((this.activeIndex() - 1 + count) % count);
        }
        return;
      case 'Enter': {
        event.preventDefault();
        const active = this.options()[this.activeIndex()];
        this.submit(active ? active.label : this.draft());
        return;
      }
      case 'Escape':
        if (this.isOpen()) {
          event.preventDefault();
          this.isOpen.set(false);
        }
        return;
    }
  }

  protected choose(option: Suggestion): void {
    this.submit(option.label);
  }

  protected clear(): void {
    this.draft.set('');
    this.isOpen.set(false);
    this.inputEl().nativeElement.focus();
  }

  private submit(rawTerm: string): void {
    const term = rawTerm.trim();
    if (!term) return;
    this.draft.set(term);
    this.isOpen.set(false);
    this.activeIndex.set(-1);
    this.inputEl().nativeElement.blur();
    this.history.record(term);
    this.search.emit(term);
  }
}
