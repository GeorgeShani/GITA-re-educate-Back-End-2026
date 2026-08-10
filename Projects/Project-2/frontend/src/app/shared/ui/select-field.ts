import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  ViewContainerRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActiveDescendantKeyManager, type Highlightable } from '@angular/cdk/a11y';
import { Overlay, type OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';

import { IconGlyph } from './icon-glyph';

export interface SelectOption {
  readonly value: string;
  readonly label: string;
}

interface OptionAdapter extends Highlightable {
  readonly id: string;
  readonly value: string;
}

/**
 * Custom listbox, not a native <select> — needed for the custom-styled
 * panel. Follows the ARIA combobox/listbox pattern: real DOM focus stays
 * on the trigger button the whole time, aria-activedescendant announces
 * the "virtually focused" option, and ActiveDescendantKeyManager drives
 * both the visual highlight and that attribute together.
 */
@Component({
  selector: 'select-field',
  imports: [IconGlyph],
  host: {
    '[style.--field-height.px]': '48',
  },
  template: `
    @if (label(); as l) {
      <label [for]="triggerId">{{ l }}</label>
    }
    <button
      #trigger
      type="button"
      class="select-field__trigger"
      [id]="triggerId"
      aria-haspopup="listbox"
      [attr.aria-expanded]="isOpen()"
      [attr.aria-activedescendant]="activeOptionId()"
      [disabled]="disabled()"
      (click)="toggle()"
      (keydown)="onTriggerKeydown($event)"
    >
      <span class="select-field__value">{{ selectedLabel() ?? placeholder() }}</span>
      <icon-glyph
        name="chevron-down"
        [size]="24"
        class="select-field__chevron"
        [class.is-open]="isOpen()"
      />
    </button>

    <ng-template #panelTemplate>
      <ul
        class="select-field__listbox"
        [class.is-entered]="entered()"
        role="listbox"
        [id]="listboxId"
        [attr.aria-labelledby]="triggerId"
        [style.width.px]="triggerWidth()"
      >
        @for (option of options(); track option.value; let i = $index) {
          <li
            #optionEl
            [id]="optionId(i)"
            role="option"
            class="select-field__option"
            [attr.aria-selected]="option.value === value()"
            (click)="selectOption(option)"
          >
            {{ option.label }}
          </li>
        }
      </ul>
    </ng-template>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    label {
      @include type.caption-1-semi;
      display: block;
      margin-bottom: var(--space-2);
    }

    .select-field__trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      width: 100%;
      height: var(--field-height, 48px);
      padding: 0 16px;
      border-radius: var(--radius-lg);
      box-shadow: inset 0 0 0 2px var(--color-border-input);
      background: var(--color-white);
      transition: box-shadow var(--duration-fast) var(--ease-out);
    }

    .select-field__trigger[aria-expanded='true'] {
      box-shadow: inset 0 0 0 2px var(--color-info);
    }

    .select-field__trigger:disabled {
      color: var(--color-neutral-04);
      cursor: not-allowed;
    }

    .select-field__value {
      @include type.body-2;
    }

    .select-field__chevron {
      flex-shrink: 0;
      transition: transform var(--duration-fast) var(--ease-out);
    }

    .select-field__chevron.is-open {
      transform: rotate(180deg);
    }

    .select-field__listbox {
      max-height: 280px;
      overflow-y: auto;
      padding: var(--space-2);
      border-radius: var(--radius-lg);
      background: var(--color-white);
      box-shadow: var(--shadow-depth-1);
      opacity: 0;
      transform: scale(0.98);
      transition:
        opacity var(--duration-fast) var(--ease-out),
        transform var(--duration-fast) var(--ease-out);
    }

    .select-field__listbox.is-entered {
      opacity: 1;
      transform: scale(1);
    }

    .select-field__option {
      @include type.body-2;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      cursor: pointer;
    }

    .select-field__option.is-active {
      background: var(--color-neutral-02);
    }

    .select-field__option[aria-selected='true'] {
      @include type.body-2-semi;
    }
  `,
})
export class SelectField {
  readonly options = input.required<SelectOption[]>();
  readonly value = input<string>();
  readonly label = input<string>();
  readonly placeholder = input('Select…');
  readonly disabled = input(false);
  readonly valueChange = output<string>();

  private static nextId = 0;
  protected readonly triggerId = `select-trigger-${SelectField.nextId}`;
  protected readonly listboxId = `select-listbox-${SelectField.nextId++}`;

  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  private readonly triggerRef = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  private readonly panelTemplate = viewChild.required<TemplateRef<unknown>>('panelTemplate');
  private readonly optionEls = viewChildren<ElementRef<HTMLLIElement>>('optionEl');

  protected readonly isOpen = signal(false);
  protected readonly entered = signal(false);
  protected readonly triggerWidth = signal(0);
  protected readonly activeOptionId = signal<string | null>(null);

  protected readonly selectedLabel = computed(
    () => this.options().find((o) => o.value === this.value())?.label,
  );

  private readonly optionAdapters = computed<OptionAdapter[]>(() =>
    this.optionEls().map((el, i) => {
      const option = this.options()[i];
      return {
        id: el.nativeElement.id,
        value: option?.value ?? '',
        getLabel: () => option?.label ?? '',
        setActiveStyles: () => el.nativeElement.classList.add('is-active'),
        setInactiveStyles: () => el.nativeElement.classList.remove('is-active'),
      };
    }),
  );

  private overlayRef: OverlayRef | null = null;

  /**
   * Fed the computed signal directly (not recreated per open) — CDK's
   * signal-aware ListKeyManager constructor overload keeps itself in sync
   * as optionAdapters() goes from empty (panel closed) to populated
   * (panel open) on its own. No pre-highlighted item on open: simpler and
   * avoids depending on exact query-refresh timing after the portal
   * attaches; the first arrow-key press activates the first item, which
   * is standard behavior for an unopened-with-nothing-highlighted listbox.
   */
  private readonly keyManager = new ActiveDescendantKeyManager(
    this.optionAdapters,
    this.injector,
  ).withWrap();

  constructor() {
    this.keyManager.change.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.activeOptionId.set(this.keyManager.activeItem?.id ?? null);
    });
  }

  protected optionId(index: number): string {
    return `${this.listboxId}-option-${index}`;
  }

  protected toggle(): void {
    if (this.isOpen()) this.close();
    else this.openPanel();
  }

  protected onTriggerKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        this.openPanel();
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const active = this.keyManager.activeItem;
      if (active) this.selectOption({ value: active.value, label: active.getLabel?.() ?? '' });
      return;
    }

    this.keyManager.onKeydown(event);
  }

  protected selectOption(option: SelectOption): void {
    this.valueChange.emit(option.value);
    this.close();
  }

  private openPanel(): void {
    if (typeof window === 'undefined' || this.disabled()) return;

    this.triggerWidth.set(this.triggerRef().nativeElement.offsetWidth);

    if (!this.overlayRef) {
      const positionStrategy = this.overlay
        .position()
        .flexibleConnectedTo(this.triggerRef())
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
        ]);
      this.overlayRef = this.overlay.create({
        positionStrategy,
        scrollStrategy: this.overlay.scrollStrategies.reposition(),
        panelClass: 'dropdown-overlay-pane',
      });
      this.overlayRef
        .outsidePointerEvents()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.close());
    }

    if (this.overlayRef.hasAttached()) return;
    this.overlayRef.attach(new TemplatePortal(this.panelTemplate(), this.viewContainerRef));
    this.isOpen.set(true);
    afterNextRender(() => this.entered.set(true), { injector: this.injector });
  }

  private close(): void {
    if (!this.overlayRef?.hasAttached()) return;
    this.overlayRef.detach();
    this.isOpen.set(false);
    this.entered.set(false);
    this.activeOptionId.set(null);
    this.triggerRef().nativeElement.focus();
  }
}
