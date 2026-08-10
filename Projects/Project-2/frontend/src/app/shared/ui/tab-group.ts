import {
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  output,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FocusKeyManager, type FocusableOption } from '@angular/cdk/a11y';

export interface TabItem {
  readonly id: string;
  readonly label: string;
}

/**
 * Tablist only — renders the tab buttons and their keyboard behavior, not
 * the panels. Pair it with a @switch on `selected` in the consumer's own
 * template; a full compound tabs+panels component is more than this
 * primitive needs to own.
 *
 * Automatic activation: arrow keys both move focus AND select, which is
 * what most simple tab widgets do (vs. the ARIA APG's alternate "manual
 * activation" pattern requiring a separate Enter to confirm).
 */
@Component({
  selector: 'tab-group',
  host: {
    role: 'tablist',
    '[attr.aria-label]': 'ariaLabel()',
  },
  template: `
    @for (tab of tabs(); track tab.id; let i = $index) {
      <button
        #tabButton
        type="button"
        role="tab"
        class="tab"
        [id]="tabId(tab.id)"
        [attr.aria-selected]="tab.id === selected()"
        [attr.aria-controls]="panelId(tab.id)"
        [attr.tabindex]="tab.id === selected() ? 0 : -1"
        (click)="select(tab.id)"
        (keydown)="onKeydown($event)"
      >
        {{ tab.label }}
      </button>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: flex;
      gap: var(--space-6);
      border-bottom: 1px solid var(--color-neutral-03);
    }

    .tab {
      @include type.body-2-semi;
      padding: var(--space-3) 0;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--color-neutral-04);
      transition:
        color var(--duration-fast) var(--ease-out),
        border-color var(--duration-fast) var(--ease-out);
    }

    .tab[aria-selected='true'] {
      color: var(--color-neutral-07);
      border-bottom-color: var(--color-neutral-07);
    }
  `,
})
export class TabGroup {
  readonly tabs = input.required<TabItem[]>();
  readonly selected = input<string>();
  readonly ariaLabel = input('');
  readonly selectedChange = output<string>();

  private readonly injector = inject(Injector);
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  private readonly focusableTabs = computed<FocusableOption[]>(() =>
    this.buttons().map((button) => ({
      focus: () => button.nativeElement.focus(),
      getLabel: () => button.nativeElement.textContent ?? '',
    })),
  );

  private readonly keyManager = new FocusKeyManager(this.focusableTabs, this.injector)
    .withHorizontalOrientation('ltr')
    .withWrap();

  constructor() {
    this.keyManager.change.pipe(takeUntilDestroyed()).subscribe((index) => {
      const tab = this.tabs()[index];
      if (tab) this.select(tab.id);
    });
  }

  protected tabId(id: string): string {
    return `tab-${id}`;
  }

  protected panelId(id: string): string {
    return `panel-${id}`;
  }

  protected select(id: string): void {
    this.selectedChange.emit(id);
  }

  protected onKeydown(event: KeyboardEvent): void {
    this.keyManager.onKeydown(event);
  }
}
