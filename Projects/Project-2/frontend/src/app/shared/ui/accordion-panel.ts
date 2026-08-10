import { Component, input } from '@angular/core';
import { CdkAccordionItem } from '@angular/cdk/accordion';

import { IconGlyph } from './icon-glyph';

/**
 * Extends CdkAccordionItem rather than wrapping it — the CDK docs
 * describe CdkAccordionItem as "expected to be extended and decorated as
 * a component" (the same pattern Angular Material's own expansion panel
 * uses). expanded/disabled are inherited plain properties, not signals —
 * read as `expanded`, not `expanded()`. Must be a descendant of
 * accordion-group, which is what actually provides CdkAccordion via DI.
 */
@Component({
  selector: 'accordion-panel',
  imports: [IconGlyph],
  template: `
    <h3 class="accordion-panel__heading">
      <button
        type="button"
        class="accordion-panel__trigger"
        [id]="headerId"
        [attr.aria-expanded]="expanded"
        [attr.aria-controls]="panelId"
        [disabled]="disabled"
        (click)="toggle()"
      >
        <span>{{ label() }}</span>
        <icon-glyph name="chevron-down" [size]="20" class="accordion-panel__chevron" />
      </button>
    </h3>
    <div
      class="accordion-panel__content"
      [class.is-expanded]="expanded"
      role="region"
      [id]="panelId"
      [attr.aria-labelledby]="headerId"
    >
      <div class="accordion-panel__body">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    .accordion-panel__heading {
      margin: 0;
    }

    .accordion-panel__trigger {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      padding: var(--space-4) 0;
      background: none;
      border: none;
      text-align: left;
      color: var(--color-neutral-07);
      @include type.body-2-semi;
    }

    .accordion-panel__trigger:disabled {
      color: var(--color-neutral-04);
      cursor: not-allowed;
    }

    .accordion-panel__chevron {
      flex-shrink: 0;
      transition: transform var(--duration-fast) var(--ease-out);
    }

    .accordion-panel__trigger[aria-expanded='true'] .accordion-panel__chevron {
      transform: rotate(180deg);
    }

    // CSS-grid height trick: animating to/from height: auto isn't possible
    // with a plain transition, but a 0fr -> 1fr grid-template-rows is —
    // the row's content (accordion-panel__body) just needs overflow:
    // hidden + min-height: 0 so it can be compressed below its own
    // content height while the row shrinks. visibility is synced with an
    // asymmetric delay so collapsed content leaves the a11y tree only
    // once fully collapsed, but re-enters it immediately on expand.
    .accordion-panel__content {
      display: grid;
      grid-template-rows: 0fr;
      visibility: hidden;
      transition:
        grid-template-rows var(--duration-base) var(--ease-out),
        visibility 0s var(--duration-base);
    }

    .accordion-panel__content.is-expanded {
      grid-template-rows: 1fr;
      visibility: visible;
      transition:
        grid-template-rows var(--duration-base) var(--ease-out),
        visibility 0s;
    }

    .accordion-panel__body {
      @include type.body-2;
      overflow: hidden;
      min-height: 0;
      padding-bottom: var(--space-4);
      color: var(--color-neutral-06);
    }
  `,
})
export class AccordionPanel extends CdkAccordionItem {
  readonly label = input.required<string>();

  protected readonly headerId = `accordion-header-${this.id}`;
  protected readonly panelId = `accordion-panel-${this.id}`;
}
