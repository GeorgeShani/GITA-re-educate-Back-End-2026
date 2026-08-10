import { Component, computed, input } from '@angular/core';

export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link';
export type ActionButtonSize = 'm' | 's' | 'xs';

/**
 * Renders <a> when href is set, <button> otherwise — a real native
 * element, not a styled <div>, so Enter/Space activation and :disabled
 * semantics come free.
 *
 * Only size-m's height/padding (h40, 6px 40px, radius 8) is a measured
 * Figma fact; s/xs are scaled off the spacing token grid and unverified.
 * Variant colors and hover states aren't in the Figma file either (see
 * SCOPE.md Open Items) — chosen off the confirmed black/white/neutral
 * palette. Check both against Figma before this ships broadly.
 */
@Component({
  selector: 'action-button',
  host: {
    '[class.full-width]': 'fullWidth()',
  },
  template: `
    @if (href(); as url) {
      <a
        class="btn"
        [class]="classes()"
        [href]="disabled() ? null : url"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.tabindex]="disabled() ? -1 : null"
      >
        @if (loading()) {
          <span class="spinner" aria-hidden="true"></span>
        }
        <ng-content />
      </a>
    } @else {
      <button
        class="btn"
        [class]="classes()"
        [type]="type()"
        [disabled]="disabled() || loading()"
        [attr.aria-busy]="loading() ? 'true' : null"
      >
        @if (loading()) {
          <span class="spinner" aria-hidden="true"></span>
        }
        <ng-content />
      </button>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    :host.full-width {
      display: block;
    }

    :host.full-width .btn {
      width: 100%;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      border-radius: var(--radius-lg);
      border: 1px solid transparent;
      cursor: pointer;
      transition: background-color var(--duration-fast) var(--ease-out);
    }

    .btn:disabled,
    .btn[aria-disabled='true'] {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .size-m {
      @include type.button-m;
      height: 40px;
      padding: 6px var(--space-10);
    }
    .size-s {
      @include type.button-s;
      height: 36px;
      padding: 6px var(--space-6);
    }
    .size-xs {
      @include type.button-xs;
      height: 32px;
      padding: 6px var(--space-4);
    }

    .variant-primary {
      background: var(--color-brand);
      color: var(--color-white);
    }
    .variant-primary:hover:not(:disabled) {
      background: var(--color-neutral-06);
    }

    .variant-secondary {
      background: var(--color-white);
      color: var(--color-neutral-07);
      border-color: var(--color-border-input);
    }
    .variant-secondary:hover:not(:disabled) {
      background: var(--color-neutral-02);
    }

    .variant-ghost {
      background: transparent;
      color: var(--color-neutral-07);
    }
    .variant-ghost:hover:not(:disabled) {
      background: var(--color-neutral-02);
    }

    .variant-link {
      background: transparent;
      color: var(--color-neutral-07);
      padding-inline: 0;
      height: auto;
      text-decoration: underline;
    }

    .spinner {
      width: 1em;
      height: 1em;
      border: 2px solid currentColor;
      border-top-color: transparent;
      border-radius: var(--radius-full);
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class ActionButton {
  readonly variant = input<ActionButtonVariant>('primary');
  readonly size = input<ActionButtonSize>('m');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly href = input<string>();
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly fullWidth = input(false);

  protected readonly classes = computed(() => `variant-${this.variant()} size-${this.size()}`);
}
