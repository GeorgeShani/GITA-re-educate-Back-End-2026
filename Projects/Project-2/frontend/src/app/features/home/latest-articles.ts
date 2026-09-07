import { NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';

import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { PageContainer } from '@/app/shared/ui/page-container';

interface Article {
  readonly title: string;
  readonly image: string;
}

/**
 * Static placeholder content — the blog module is Phase F9, not built yet.
 * No routerLink to /blog/:slug until that route (and real post data) exists;
 * these render as non-interactive previews rather than links to a 404.
 */
const ARTICLES: readonly Article[] = [
  { title: 'Reading Greens Like a Pro', image: '/images/products/article-putting.jpg' },
  { title: 'The Timeless Classics on the Green', image: '/images/products/article-classics.jpg' },
  { title: 'Inside the Ryder Cup Gallery', image: '/images/products/article-tournament.jpg' },
];

@Component({
  selector: 'latest-articles',
  imports: [NgOptimizedImage, IconGlyph, PageContainer],
  template: `
    <page-container>
      <header class="section-head">
        <h2>Latest Articles</h2>
      </header>
      <div class="grid">
        @for (article of articles; track article.title) {
          <article class="card">
            <div class="card-image">
              <img [ngSrc]="article.image" alt="" fill />
            </div>
            <h3>{{ article.title }}</h3>
            <span class="read-more">
              Read more
              <icon-glyph name="arrow-right" [size]="18" />
            </span>
          </article>
        }
      </div>
    </page-container>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    :host {
      display: block;
    }

    .section-head {
      margin-bottom: var(--space-8);
    }

    h2 {
      @include type.headline-5;
      margin: 0;
      color: var(--color-neutral-07);

      @include bp.tablet-up {
        @include type.headline-4;
      }
    }

    .grid {
      display: grid;
      gap: var(--space-6);
      grid-template-columns: 1fr;

      @include bp.tablet-up {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .card-image {
      position: relative;
      aspect-ratio: 357 / 325;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-neutral-02);

      img {
        object-fit: cover;
      }
    }

    h3 {
      @include type.headline-7;
      margin: var(--space-4) 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .read-more {
      @include type.body-2-semi;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-neutral-04);
    }
  `,
})
export class LatestArticles {
  protected readonly articles = ARTICLES;
}
