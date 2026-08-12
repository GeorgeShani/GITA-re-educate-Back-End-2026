import { Component, input } from '@angular/core';

/** WCAG skip-to-content — visually hidden until focused, first focusable element on the page. Pair `target` with an id on the main landmark (see app.html). */
@Component({
  selector: 'skip-link',
  template: `<a class="skip-link" [attr.href]="target()">{{ label() }}</a>`,
  styles: `
    .skip-link {
      position: fixed;
      top: -48px;
      left: var(--space-2);
      z-index: var(--z-toast);
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      background: var(--color-neutral-07);
      color: var(--color-white);
      transition: top var(--duration-fast) var(--ease-out);
    }

    .skip-link:focus-visible {
      top: var(--space-2);
    }
  `,
})
export class SkipLink {
  readonly target = input('#main-content');
  readonly label = input('Skip to content');
}
