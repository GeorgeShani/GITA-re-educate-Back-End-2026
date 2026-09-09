import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { PostQuery } from '@/app/core/api/dto';
import { BlogService } from '@/app/core/services/blog.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { PaginationNav } from '@/app/shared/ui/pagination-nav';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

const TAKE = 9;

/**
 * Blog list, filtered by category or tag.
 *
 * Same "filter state lives in the URL" convention as shop.ts. Category/tag
 * filters are sent as ids, not slugs — FindPostsDto only accepts
 * `@IsMongoId()`, and Tag has no slug at all (tag.schema.ts), so there's no
 * pretty-URL option here without a slug this API doesn't have.
 */
@Component({
  selector: 'blog-list-page',
  imports: [RouterLink, DatePipe, NgOptimizedImage, RevealDirective, PageContainer, PageSection, PaginationNav, SkeletonBlock],
  template: `
    <page-section spacing="md">
      <page-container>
        <header class="head" reveal>
          <h1>Journal</h1>
          <p class="subhead">Course guides, gear reviews, technique, and stories from the game.</p>
        </header>

        <div class="layout" reveal>
          <aside class="filters" aria-label="Filters">
            <section>
              <h2>Category</h2>
              <ul role="list">
                <li>
                  <button type="button" [class.active]="!category()" (click)="setParam('category', null)">
                    All posts
                  </button>
                </li>
                @for (cat of categories.value() ?? []; track cat.id) {
                  <li>
                    <button
                      type="button"
                      [class.active]="category() === cat.id"
                      (click)="setParam('category', cat.id)"
                    >
                      {{ cat.name }}
                    </button>
                  </li>
                }
              </ul>
            </section>

            @if ((tags.value() ?? []).length) {
              <section>
                <h2>Tags</h2>
                <ul class="tag-list" role="list">
                  @for (t of tags.value() ?? []; track t.id) {
                    <li>
                      <button type="button" [class.active]="tag() === t.id" (click)="setParam('tag', t.id)">
                        {{ t.name }}
                      </button>
                    </li>
                  }
                </ul>
              </section>
            }
          </aside>

          <div class="results">
            @if (posts.isLoading()) {
              <div class="grid">
                @for (n of skeletons; track n) {
                  <skeleton-block height="360px" radius="var(--radius-lg)" />
                }
              </div>
            } @else if (posts.error()) {
              <p class="message">Could not load the journal right now.</p>
            } @else if (items().length === 0) {
              <p class="message">No posts match those filters.</p>
            } @else {
              <div class="grid">
                @for (post of items(); track post.id) {
                  <a class="card" [routerLink]="['/blog', post.slug]">
                    <div class="card-image">
                      @if (post.coverImageUrl) {
                        <img [ngSrc]="post.coverImageUrl" alt="" fill />
                      }
                    </div>
                    <div class="card-body">
                      @if (categoryName(post.categoryId); as name) {
                        <span class="card-category">{{ name }}</span>
                      }
                      <h3>{{ post.title }}</h3>
                      @if (post.excerpt) {
                        <p class="card-excerpt">{{ post.excerpt }}</p>
                      }
                      <span class="card-date">{{ post.publishedAt | date: 'mediumDate' }}</span>
                    </div>
                  </a>
                }
              </div>

              @if (pageCount() > 1) {
                <pagination-nav
                  [page]="page()"
                  [total]="pageCount()"
                  (pageChange)="setParam('page', $event === 1 ? null : String($event))"
                />
              }
            }
          </div>
        </div>
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;
    @use 'styles/breakpoints' as bp;

    .head {
      margin-bottom: var(--space-8);
    }

    h1 {
      @include type.headline-5;
      margin: 0 0 var(--space-2);
      color: var(--color-neutral-07);
    }

    .subhead {
      @include type.body-2;
      margin: 0;
      color: var(--color-neutral-04);
      max-width: 40rem;
    }

    .layout {
      display: grid;
      gap: var(--space-8);

      @include bp.tablet-up {
        grid-template-columns: 220px minmax(0, 1fr);
      }
    }

    .filters {
      display: grid;
      gap: var(--space-8);
      align-content: start;

      h2 {
        @include type.caption-1-semi;
        margin: 0 0 var(--space-3);
        color: var(--color-neutral-07);
      }

      ul {
        display: grid;
        gap: var(--space-1);
        margin: 0;
        padding: 0;
      }

      button {
        @include type.caption-1;
        display: block;
        width: 100%;
        padding: var(--space-2) var(--space-3);
        border: 0;
        border-radius: var(--radius-md);
        background: none;
        color: var(--color-neutral-05);
        text-align: left;
        cursor: pointer;

        &:hover {
          background: var(--color-neutral-02);
        }

        &.active {
          background: var(--color-neutral-07);
          color: var(--color-neutral-01);
        }
      }
    }

    .tag-list {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);

      button {
        width: auto;
        border-radius: var(--radius-full);
        box-shadow: inset 0 0 0 1px var(--color-neutral-03);
      }
    }

    .grid {
      display: grid;
      gap: var(--space-6);
      grid-template-columns: 1fr;

      @include bp.tablet-up {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      @media (min-width: 1100px) {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }

    .card {
      display: flex;
      flex-direction: column;
      color: inherit;
    }

    .card-image {
      position: relative;
      aspect-ratio: 4 / 3;
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-neutral-02);

      img {
        object-fit: cover;
      }
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding-top: var(--space-4);
    }

    .card-category {
      @include type.caption-2-semi;
      color: var(--color-neutral-04);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .card-body h3 {
      @include type.body-1-semi;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .card-excerpt {
      @include type.body-2;
      margin: 0;
      color: var(--color-neutral-05);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .card-date {
      @include type.caption-2;
      color: var(--color-neutral-04);
    }

    pagination-nav {
      display: block;
      margin-top: var(--space-10);
    }

    .message {
      @include type.body-2;
      color: var(--color-neutral-04);
    }
  `,
})
export default class BlogList {
  private readonly blog = inject(BlogService);
  private readonly router = inject(Router);

  // Bound from the URL by withComponentInputBinding().
  readonly category = input<string>();
  readonly tag = input<string>();
  protected readonly pageParam = input<string>('1', { alias: 'page' });

  protected readonly skeletons = [0, 1, 2, 3, 4, 5];
  protected readonly String = String;

  protected readonly page = computed(() => {
    const parsed = Number(this.pageParam());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  });

  private readonly query = computed<PostQuery>(() => ({
    category: this.category(),
    tag: this.tag(),
    page: this.page(),
    take: TAKE,
  }));

  protected readonly posts = this.blog.postsResource(() => this.query());
  protected readonly categories = this.blog.categoriesResource();
  protected readonly tags = this.blog.tagsResource();

  protected readonly items = computed(() => this.posts.value()?.items ?? []);
  protected readonly total = computed(() => this.posts.value()?.total ?? 0);
  protected readonly pageCount = computed(() => Math.ceil(this.total() / TAKE));

  protected categoryName(categoryId: string | undefined): string | undefined {
    if (!categoryId) return undefined;
    return (this.categories.value() ?? []).find((c) => c.id === categoryId)?.name;
  }

  protected setParam(key: string, value: string | null): void {
    void this.router.navigate([], {
      queryParams: { [key]: value, ...(key === 'page' ? {} : { page: null }) },
      queryParamsHandling: 'merge',
    });
  }
}
