import { Component, input } from '@angular/core';

// Re-exported from the generated sprite rather than redeclared here: a
// hand-maintained copy silently accepts names the sprite no longer has,
// which renders an empty <use> with no error anywhere.
export type { IconName } from '@/app/shared/ui/icon-sprite';
import type { IconName } from '@/app/shared/ui/icon-sprite';

/**
 * Renders one symbol from the sprite mounted at the app root (see
 * IconSprite). Decorative by default (aria-hidden); pass `label` when the
 * icon is the only content conveying meaning (e.g. an icon-only button
 * should label the button itself, not this).
 */
@Component({
  selector: 'icon-glyph',
  host: {
    '[attr.aria-hidden]': "label() ? null : 'true'",
    '[attr.role]': "label() ? 'img' : null",
    '[attr.aria-label]': 'label()',
  },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="currentColor">
      <use [attr.href]="'#' + name()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    svg {
      display: block;
    }
  `,
})
export class IconGlyph {
  readonly name = input.required<IconName>();
  readonly size = input(24);
  readonly label = input<string>();
}
