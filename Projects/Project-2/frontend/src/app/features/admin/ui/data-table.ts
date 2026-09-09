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
 *
 * Sticky header + zebra rows + a denser default padding — one edit here
 * lifts every admin table at once, per Operate mode's own "clean, dense"
 * bar (SCOPE.md/F12 plan). Feedback-only, no page-load choreography:
 * nothing here animates on mount, only :hover reacts.
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

    // Sticky to the th itself, not the thead row-group — position: sticky
    // on <thead> isn't reliable cross-browser, on <th> it is. Needs its
    // own opaque background (not inherited): once stuck, rows scroll
    // underneath it and would show through a transparent header otherwise.
    ::ng-deep th {
      @include type.caption-2-semi;
      position: sticky;
      top: 0;
      z-index: 1;
      padding: var(--space-2) var(--space-4);
      background: var(--color-neutral-02);
      color: var(--color-neutral-05);
      text-align: left;
      white-space: nowrap;
    }

    ::ng-deep td {
      @include type.body-2;
      padding: var(--space-2) var(--space-4);
      color: var(--color-neutral-07);
      border-top: 1px solid var(--color-neutral-03);
      vertical-align: middle;
    }

    ::ng-deep tbody tr:nth-child(even) {
      background: color-mix(in srgb, var(--color-neutral-02) 45%, transparent);
    }

    // Wins over the zebra tint regardless of which row it lands on — a
    // fixed color instead of another color-mix over it, so hover always
    // reads as one consistent state rather than two slightly different
    // ones depending on row parity.
    ::ng-deep tbody tr:hover {
      background: var(--color-neutral-02);
    }
  `,
})
export class DataTable {}
