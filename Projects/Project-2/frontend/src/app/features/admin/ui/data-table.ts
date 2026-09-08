import { Component } from '@angular/core';

/**
 * Table chrome only — scroll wrapper, border, header/row styling. Callers
 * project a real <table><thead>...<tbody>... themselves; sort/select/row
 * logic stays in the page, not here.
 *
 * The projected thead/tbody carry the CALLER's emulated-encapsulation
 * attribute, not this component's — same reason blog-post.ts/content-
 * page.ts need ::ng-deep for [innerHTML] content. A scoped "th {}" rule
 * here would silently match nothing.
 */
@Component({
  selector: 'data-table',
  template: `
    <div class="scroll">
      <table>
        <ng-content />
      </table>
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
      border-radius: var(--radius-lg);
      box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      overflow: hidden;
    }

    .scroll {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    ::ng-deep thead {
      background: var(--color-neutral-02);
    }

    ::ng-deep th {
      @include type.caption-2-semi;
      padding: var(--space-3) var(--space-4);
      color: var(--color-neutral-05);
      text-align: left;
      white-space: nowrap;
    }

    ::ng-deep td {
      @include type.body-2;
      padding: var(--space-3) var(--space-4);
      color: var(--color-neutral-07);
      border-top: 1px solid var(--color-neutral-03);
      vertical-align: middle;
    }

    ::ng-deep tbody tr:hover {
      background: var(--color-neutral-02);
    }
  `,
})
export class DataTable {}
