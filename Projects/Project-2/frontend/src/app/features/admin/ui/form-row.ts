import { Component, input } from '@angular/core';

/** Label + control + error/hint layout for admin CRUD forms — one per field. */
@Component({
  selector: 'form-row',
  template: `
    <label [for]="controlId()">{{ label() }}</label>
    <ng-content />
    @if (error(); as e) {
      <p class="error">{{ e }}</p>
    } @else if (hint(); as h) {
      <p class="hint">{{ h }}</p>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    label {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
    }

    .error {
      @include type.caption-2;
      margin: 0;
      color: var(--color-error);
    }

    .hint {
      @include type.caption-2;
      margin: 0;
      color: var(--color-neutral-04);
    }
  `,
})
export class FormRow {
  readonly label = input.required<string>();
  readonly controlId = input<string>();
  readonly error = input<string>();
  readonly hint = input<string>();
}
