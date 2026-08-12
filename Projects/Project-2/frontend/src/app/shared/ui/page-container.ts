import { Component } from '@angular/core';

/** The 1120px content container, mobile-first 32px page padding widening to 160px at desktop — see _tokens.scss. */
@Component({
  selector: 'page-container',
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
      max-width: var(--container-max);
      margin-inline: auto;
      padding-inline: var(--page-padding);
    }
  `,
})
export class PageContainer {}
