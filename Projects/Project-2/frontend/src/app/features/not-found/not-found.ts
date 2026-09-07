import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ActionButton } from '@/app/shared/ui/action-button';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';

@Component({
  selector: 'not-found-page',
  imports: [RouterLink, PageContainer, PageSection, ActionButton],
  template: `
    <page-section spacing="lg">
      <page-container>
        <h1>Page not found</h1>
        <p>That page does not exist, or it has moved.</p>
        <action-button routerLink="/" size="m">Back to home</action-button>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-3);
      color: var(--color-neutral-07);
    }

    p {
      @include type.body-2;
      margin: 0 0 var(--space-8);
    }
  `,
})
export default class NotFound {}
