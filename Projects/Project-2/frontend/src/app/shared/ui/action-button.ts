import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link' | 'inverse';
export type ActionButtonSize = 'm' | 's' | 'xs';

/**
 * Renders <a [routerLink]> when routerLink is set, plain <a href> when
 * only href is set, <button> otherwise — a real native element, not a
 * styled <div>, so Enter/Space activation and :disabled semantics come
 * free. routerLink and href are separate on purpose: an internal route
 * needs Angular's router (no full page reload), an external link needs
 * a plain href, and conflating them risks silently full-reloading an
 * internal navigation.
 *
 * Only size-m's height/padding (h40, 6px 40px, radius 8) is a measured
 * Figma fact; s/xs are scaled off the spacing token grid and unverified.
 * Variant colors and hover states aren't in the Figma file either (see
 * SCOPE.md Open Items) — chosen off the confirmed black/white/neutral
 * palette. Check both against Figma before this ships broadly.
 */
@Component({
  selector: 'action-button',
  imports: [RouterLink, NgTemplateOutlet],
  host: {
    '[class.full-width]': 'fullWidth()',
  },
  template: `
    <!--
      One <ng-content>, rendered through a template outlet in each branch.
      Projected content is MOVED into its slot, not copied, so repeating
      <ng-content> once per @if branch leaves every branch but one with an
      empty element — which is exactly how this shipped: as a link, the
      button rendered with no label at all.
    -->
    <ng-template #body>
      @if (loading()) {
        <span class="spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </ng-template>

    @if (routerLink(); as link) {
      <a
        class="btn"
        [class]="classes()"
        [routerLink]="disabled() ? null : link"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.tabindex]="disabled() ? -1 : null"
      >
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else if (href(); as url) {
      <a
        class="btn"
        [class]="classes()"
        [href]="disabled() ? null : url"
        [attr.aria-disabled]="disabled() ? 'true' : null"
        [attr.tabindex]="disabled() ? -1 : null"
      >
        <ng-container [ngTemplateOutlet]="body" />
      </a>
    } @else {
      <button
        class="btn"
        [class]="classes()"
        [type]="type()"
        [disabled]="disabled() || loading()"
        [attr.aria-busy]="loading() ? 'true' : null"
      >
        <ng-container [ngTemplateOutlet]="body" />
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
    }

    // A real disabled treatment, not just opacity: 0.5 (which turned the
    // black primary into a mid-grey that read as an ordinary button).
    .variant-primary:disabled,
    .variant-primary[aria-disabled='true'] {
      background: var(--color-neutral-03);
      color: var(--color-neutral-04);
    }

    .variant-secondary:disabled,
    .variant-secondary[aria-disabled='true'],
    .variant-ghost:disabled,
    .variant-ghost[aria-disabled='true'],
    .variant-link:disabled,
    .variant-link[aria-disabled='true'],
    .variant-inverse:disabled,
    .variant-inverse[aria-disabled='true'] {
      opacity: 0.45;
    }

    .btn:active:not(:disabled):not([aria-disabled='true']) {
      transform: scale(0.97);
      transition: transform var(--duration-instant) var(--ease-in);
    }

    // variant-primary's black fill shows up directly on dark sections too
    // (the home hero's "Shop the range" CTA sits on the hero photo/scrim),
    // where the default blue focus ring can land on more dark pixels
    // instead of the page behind it — swap to a light ring there.
    .variant-primary:focus-visible {
      outline-color: var(--color-neutral-01);
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

    .variant-secondary {
      background: var(--color-white);
      color: var(--color-neutral-07);
      border-color: var(--color-border-input);
    }

    .variant-ghost {
      background: transparent;
      color: var(--color-neutral-07);
    }

    .variant-link {
      background: transparent;
      color: var(--color-neutral-07);
      padding-inline: 0;
      height: auto;
      text-decoration: underline;
    }

    // For CTAs on a dark surface (the sale banner, newsletter) where the
    // primary black fill would disappear: invert to a white fill. Reads as
    // the same button, just flipped — and leaves --color-success free to
    // mean "sale / success" rather than "this is a button".
    .variant-inverse {
      background: var(--color-white);
      color: var(--color-neutral-07);
    }

    // Hover-only affordances — guarded so a touch tap doesn't leave the
    // button stuck in its hover fill with no way to un-hover.
    @media (hover: hover) and (pointer: fine) {
      .variant-primary:hover:not(:disabled) {
        background: var(--color-neutral-06);
      }

      .variant-secondary:hover:not(:disabled) {
        background: var(--color-neutral-02);
      }

      .variant-ghost:hover:not(:disabled) {
        background: var(--color-neutral-02);
      }

      .variant-inverse:hover:not(:disabled) {
        background: var(--color-neutral-02);
      }
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
  readonly routerLink = input<string | unknown[]>();
  readonly href = input<string>();
  readonly loading = input(false);
  readonly disabled = input(false);
  readonly fullWidth = input(false);

  protected readonly classes = computed(() => `variant-${this.variant()} size-${this.size()}`);
}
