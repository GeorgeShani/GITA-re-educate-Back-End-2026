import { Component, input, output } from '@angular/core';

import { ActionButton } from '@/app/shared/ui/action-button';
import { DrawerPanel } from '@/app/shared/ui/drawer-panel';

/** Shared create/edit shell: drawer-panel + title + save/cancel footer. The body is projected. */
@Component({
  selector: 'drawer-form',
  imports: [DrawerPanel, ActionButton],
  template: `
    <drawer-panel side="right" [open]="open()" (openChange)="openChange.emit($event)">
      <div class="drawer-form">
        <h2>{{ title() }}</h2>
        <div class="body">
          <ng-content />
        </div>
        <div class="footer">
          <button type="button" class="cancel" (click)="cancel.emit()">Cancel</button>
          <action-button size="s" [loading]="saving()" (click)="save.emit()">{{ saveLabel() }}</action-button>
        </div>
      </div>
    </drawer-panel>
  `,
  styles: `
    @use 'styles/typography' as type;

    .drawer-form {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    h2 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-07);
    }

    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }

    .footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-4);
      padding-top: var(--space-4);
      border-top: 1px solid var(--color-neutral-03);
    }

    .cancel {
      @include type.caption-1-semi;
      color: var(--color-neutral-05);
      text-decoration: underline;
    }
  `,
})
export class DrawerForm {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly saving = input(false);
  readonly saveLabel = input('Save');
  readonly openChange = output<boolean>();
  readonly save = output<void>();
  readonly cancel = output<void>();
}
