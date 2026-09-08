import { NgOptimizedImage } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BlogService } from '@/app/core/services/blog.service';
import { IconGlyph } from '@/app/shared/ui/icon-glyph';
import { PageContainer } from '@/app/shared/ui/page-container';

const TAKE = 3;

/** Real latest posts, replacing the F9-pending static placeholder that used to live here. */
@Component({
  selector: 'latest-articles',
  imports: [RouterLink, NgOptimizedImage, IconGlyph, PageContainer],
  template: `
    @if (articles().length > 0) {
      <page-container>
        <header class="section-head">
          <h2>Latest Articles</h2>
        </header>
        <div class="grid">
          @for (article of articles(); track article.slug) {
            <a class="card" [routerLink]="['/blog', article.slug]">
              <div class="card-image">
                @if (article.coverImageUrl) {
                  <img [ngSrc]="article.coverImageUrl" alt="" fill />
                }
              </div>
              <h3>{{ article.title }}</h3>
              <span class="read-more">
                Read more
                <icon-glyph name="arrow-right" [size]="18" />
              </span>
            </a>
          }
        </div>
      </page-container>
    }
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

    .card {
      display: block;
      color: inherit;
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
  private readonly blog = inject(BlogService);

  private readonly posts = this.blog.postsResource(() => ({ take: TAKE }));

  protected readonly articles = computed(() =>
    (this.posts.value()?.items ?? []).map((post) => ({
      slug: post.slug,
      title: post.title,
      coverImageUrl: post.coverImageUrl,
    })),
  );
}
