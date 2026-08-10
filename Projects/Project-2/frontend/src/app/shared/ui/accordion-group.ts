import { Component } from '@angular/core';
import { CdkAccordion } from '@angular/cdk/accordion';

/** Coordinates expand/collapse among child accordion-panel items — put multiple panels inside. */
@Component({
  selector: 'accordion-group',
  hostDirectives: [{ directive: CdkAccordion, inputs: ['multi'] }],
  template: `<ng-content />`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class AccordionGroup {}
