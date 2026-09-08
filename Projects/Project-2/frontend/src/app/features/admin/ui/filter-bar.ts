import { Component } from '@angular/core';

/** Flex row for list-page filter controls (search, selects, date range) — wraps on narrow viewports. */
@Component({
  selector: 'filter-bar',
  template: `<ng-content />`,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }
  `,
})
export class FilterBar {}
