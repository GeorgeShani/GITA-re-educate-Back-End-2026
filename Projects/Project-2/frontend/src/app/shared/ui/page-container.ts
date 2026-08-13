import { Component } from '@angular/core';

/** The 1120px content container, mobile-first 32px page padding widening to 160px at desktop — see _tokens.scss. */
@Component({
  selector: 'page-container',
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      /* box-sizing is border-box (global reset), so padding eats into
         max-width unless it's added back here — --container-max (1120px)
         is the measured Figma *content* width, not the outer box. */
      max-width: calc(var(--container-max) + var(--page-padding) * 2);
      margin-inline: auto;
      padding-inline: var(--page-padding);
    }
  `,
})
export class PageContainer {}
