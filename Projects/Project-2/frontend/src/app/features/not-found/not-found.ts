import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';

@Component({
  selector: 'not-found-page',
  imports: [RouterLink, PageContainer, PageSection, ActionButton, RevealDirective],
  template: `
    <page-section spacing="lg">
      <page-container>
        <div class="shell" reveal>
          <p class="code">404</p>
          <h1>Page not found</h1>
          <p class="message">That page does not exist, or it has moved.</p>
          <action-button routerLink="/" size="m">Back to home</action-button>
        </div>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;

    .shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 26rem;
      margin: 0 auto;
      padding-block: var(--space-10);
      text-align: center;
    }

    .code {
      @include type.headline-2;
      margin: 0;
      color: var(--color-neutral-03);
    }

    h1 {
      @include type.headline-5;
      margin: var(--space-2) 0 var(--space-3);
      color: var(--color-neutral-07);
    }

    .message {
      @include type.body-2;
      margin: 0 0 var(--space-8);
      color: var(--color-neutral-04);
    }
  `,
})
export default class NotFound {}
