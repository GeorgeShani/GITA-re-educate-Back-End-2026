import { Component, inject, input } from '@angular/core';

import { ContentPagesService } from '@/app/core/services/content-pages.service';
import NotFound from '@/app/features/not-found/not-found';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

/**
 * Static CMS pages (about, shipping, returns, privacy, terms, FAQ) — one
 * component for all of them, since they're all just a title + rich body.
 * Bound to the root-level `:slug` route, so it's also the effective
 * catch-all for any unknown single-segment path: an unresolved slug 404s
 * from the API and this renders the real not-found page.
 */
@Component({
  selector: 'content-page',
  imports: [RevealDirective, PageContainer, PageSection, SkeletonBlock, NotFound],
  template: `
    @if (page.error()) {
      <not-found-page />
    } @else {
      <page-section spacing="md">
        <page-container>
          @if (page.isLoading()) {
            <div class="loading" reveal>
              <skeleton-block height="40px" width="280px" />
              <skeleton-block height="20px" width="100%" />
              <skeleton-block height="20px" width="90%" />
              <skeleton-block height="20px" width="95%" />
            </div>
          } @else if (page.value(); as p) {
            <h1 reveal>{{ p.title }}</h1>
            <div class="body" reveal [innerHTML]="p.body"></div>
          }
        </page-container>
      </page-section>
    }
  `,
  styles: `
    @use 'styles/typography' as type;

    .loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      max-width: 42rem;
    }

    h1 {
      @include type.headline-4;
      margin: 0 0 var(--space-8);
      color: var(--color-neutral-07);
    }

    /* Same ::ng-deep rationale as blog-post.ts — [innerHTML] content never
       carries the emulated-encapsulation host attribute a scoped rule needs. */
    .body {
      @include type.body-1;
      max-width: 42rem;
      color: var(--color-neutral-06);

      ::ng-deep h2 {
        @include type.headline-6;
        margin: var(--space-8) 0 var(--space-3);
        color: var(--color-neutral-07);

        &:first-child {
          margin-top: 0;
        }
      }

      ::ng-deep p {
        margin: 0 0 var(--space-4);
      }

      ::ng-deep ul {
        margin: 0 0 var(--space-4);
        padding-left: var(--space-6);
      }

      ::ng-deep li {
        margin-bottom: var(--space-2);
      }

      ::ng-deep a {
        color: var(--color-info-text);
        text-decoration: underline;
      }

      ::ng-deep strong {
        color: var(--color-neutral-07);
      }
    }
  `,
})
export default class ContentPage {
  private readonly pages = inject(ContentPagesService);

  readonly slug = input.required<string>();

  protected readonly page = this.pages.pageResource(() => this.slug());
}
