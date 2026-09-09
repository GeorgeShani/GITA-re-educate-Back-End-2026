import { Component, input, output } from '@angular/core';

import { IconGlyph, type IconName } from './icon-glyph';

/**
 * Icon-only button — ariaLabel is required since there's no visible text
 * to name it by. `pressed` is left unset for a plain action button; pass
 * it for a toggle (e.g. wishlist heart) to get aria-pressed.
 *
 * Hover treatment isn't in the Figma file — a generic background tint,
 * flagged like the other unverified interactive states in this tier.
 * The tint is derived from currentColor rather than a fixed light shade:
 * icon-button shows up on both light surfaces (nav, product cards) and
 * dark ones (toast close button), and a hardcoded light fill washed out
 * against a white icon on a dark background — the X became invisible on
 * hover in exactly that case.
 */
@Component({
  selector: 'icon-button',
  imports: [IconGlyph],
  template: `
    <button
      type="button"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-pressed]="pressed() === undefined ? null : pressed()"
      [disabled]="disabled()"
      (click)="clicked.emit()"
    >
      <icon-glyph [name]="icon()" [size]="18" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 4px;
      border-radius: var(--radius-full);
      border: none;
      background: none;
      color: inherit;
      transition: background-color var(--duration-fast) var(--ease-out);
    }

    @media (hover: hover) and (pointer: fine) {
      button:hover:not(:disabled) {
        background: color-mix(in srgb, currentColor 14%, transparent);
      }
    }

    button:active:not(:disabled) {
      transform: scale(0.97);
      transition: transform var(--duration-instant) var(--ease-in);
    }

    button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    // icon-button shows up on both light surfaces and dark ones (toast
    // close button, tooltip trigger chrome) — color: inherit already
    // makes the icon itself adapt via currentColor (see class comment
    // above), so the focus ring adapts the same way instead of a fixed
    // blue that disappears against a near-black fill.
    button:focus-visible {
      outline-color: currentColor;
    }
  `,
})
export class IconButton {
  readonly icon = input.required<IconName>();
  readonly ariaLabel = input.required<string>();
  readonly pressed = input<boolean>();
  readonly disabled = input(false);
  readonly clicked = output<void>();
}
