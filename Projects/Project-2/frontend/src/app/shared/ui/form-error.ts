import { Component, input } from '@angular/core';

import { IconGlyph } from '@/app/shared/ui/icon-glyph';

/**
 * A form-level error from the server ("Invalid email or password"), shown
 * inside the form next to its submit button rather than as a toast — the
 * failure belongs to what the person just typed, so it should stay put
 * while they fix it. Per-field validation stays in text-field's own slot.
 *
 * role="alert" makes screen readers announce it the moment it's rendered;
 * parents render it with @if so an empty one never takes up a flex gap.
 */
@Component({
  selector: 'form-error',
  imports: [IconGlyph],
  template: `
    <p class="error" role="alert">
      <icon-glyph name="triangle-alert" [size]="18" />
      <span>{{ message() }}</span>
    </p>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    .error {
      @include type.caption-1;
      display: flex;
      align-items: flex-start;
      gap: var(--space-2);
      margin: 0;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-lg);
      background: color-mix(in srgb, var(--color-error) 8%, transparent);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-error) 24%, transparent);
      color: var(--color-error);

      icon-glyph {
        flex-shrink: 0;
        // Optically centre the 18px glyph on the caption's first line.
        margin-top: 1px;
      }
    }
  `,
})
export class FormError {
  readonly message = input.required<string>();
}
