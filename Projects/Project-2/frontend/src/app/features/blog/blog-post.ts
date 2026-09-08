import { DatePipe, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormField, email, form, required } from '@angular/forms/signals';

import type { CommentDto } from '@/app/core/api/dto';
import { AuthService } from '@/app/core/services/auth.service';
import { BlogService } from '@/app/core/services/blog.service';
import { ToastService } from '@/app/core/services/toast.service';
import { RevealDirective } from '@/app/shared/directives/reveal.directive';
import { ActionButton } from '@/app/shared/ui/action-button';
import { PageContainer } from '@/app/shared/ui/page-container';
import { PageSection } from '@/app/shared/ui/page-section';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';

interface CommentFormModel {
  authorName: string;
  authorEmail: string;
  body: string;
}

/**
 * Post detail. Comments are fetched (approved only) and submitted here;
 * a submitted comment never appears in that list itself — it lands as
 * `pending` (blog.controller.ts) — so a freshly-submitted comment is kept
 * in a local signal and rendered with a "pending" tag instead of silently
 * vanishing after a successful submit.
 */
@Component({
  selector: 'blog-post-page',
  imports: [RouterLink, DatePipe, NgOptimizedImage, RevealDirective, ActionButton, FormField, PageContainer, PageSection, SkeletonBlock],
  template: `
    <page-section spacing="md">
      <page-container>
        @if (post.isLoading()) {
          <div class="loading" reveal>
            <skeleton-block height="32px" width="240px" />
            <skeleton-block height="320px" width="100%" />
            <skeleton-block height="20px" width="100%" />
            <skeleton-block height="20px" width="80%" />
          </div>
        } @else if (post.error()) {
          <p class="message" reveal>This post couldn't be found.</p>
          <a routerLink="/blog" class="back" reveal>← Back to the journal</a>
        } @else if (post.value(); as p) {
          <a routerLink="/blog" class="back" reveal>← Back to the journal</a>

          <header class="head" reveal>
            <h1>{{ p.title }}</h1>
            <p class="meta">{{ p.publishedAt | date: 'longDate' }}</p>
          </header>

          @if (p.coverImageUrl) {
            <div class="cover" reveal>
              <img [ngSrc]="p.coverImageUrl" alt="" fill priority />
            </div>
          }

          <div class="body" reveal [innerHTML]="p.body"></div>

          <section class="comments" reveal>
            <h2>Comments</h2>

            @if (comments.isLoading()) {
              <skeleton-block height="80px" width="100%" />
            } @else {
              @let approved = comments.value() ?? [];
              @if (approved.length === 0 && pendingComments().length === 0) {
                <p class="empty">Be the first to comment.</p>
              } @else {
                <ul class="comment-list" role="list">
                  @for (comment of approved; track comment.id) {
                    <li class="comment">
                      <div class="comment-head">
                        <strong>{{ comment.authorName }}</strong>
                        <span>{{ comment.createdAt | date: 'mediumDate' }}</span>
                      </div>
                      <p>{{ comment.body }}</p>
                    </li>
                  }
                  @for (comment of pendingComments(); track comment.authorName + comment.body) {
                    <li class="comment is-pending">
                      <div class="comment-head">
                        <strong>{{ comment.authorName }}</strong>
                        <span class="pending-tag">Pending approval</span>
                      </div>
                      <p>{{ comment.body }}</p>
                    </li>
                  }
                </ul>
              }
            }

            <form class="comment-form" (submit)="onSubmitComment($event)" novalidate>
              <h3>Leave a comment</h3>
              <div class="row">
                <div class="field">
                  <label for="authorName">Name</label>
                  <input id="authorName" type="text" [formField]="commentForm.authorName" />
                  @if (commentForm.authorName().touched() && commentForm.authorName().errors()[0]; as err) {
                    <p class="error">{{ err.message }}</p>
                  }
                </div>
                <div class="field">
                  <label for="authorEmail">Email</label>
                  <input id="authorEmail" type="email" [formField]="commentForm.authorEmail" />
                  @if (commentForm.authorEmail().touched() && commentForm.authorEmail().errors()[0]; as err) {
                    <p class="error">{{ err.message }}</p>
                  }
                </div>
              </div>
              <div class="field">
                <label for="commentBody">Comment</label>
                <textarea id="commentBody" rows="4" [formField]="commentForm.body"></textarea>
                @if (commentForm.body().touched() && commentForm.body().errors()[0]; as err) {
                  <p class="error">{{ err.message }}</p>
                }
              </div>
              <p class="hint">Comments are held for moderation before they appear publicly.</p>
              <action-button type="submit" size="m" [loading]="submitting()">Post comment</action-button>
            </form>
          </section>
        }
      </page-container>
    </page-section>
  `,
  styles: `
    @use 'styles/typography' as type;

    .loading {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .back {
      @include type.caption-1-semi;
      display: inline-block;
      margin-bottom: var(--space-6);
      color: var(--color-neutral-04);
    }

    .head {
      max-width: 42rem;
      margin: 0 auto var(--space-8);
      text-align: center;
    }

    h1 {
      @include type.headline-4;
      margin: 0 0 var(--space-3);
      color: var(--color-neutral-07);
    }

    .meta {
      @include type.body-2;
      margin: 0;
      color: var(--color-neutral-04);
    }

    .cover {
      position: relative;
      aspect-ratio: 16 / 9;
      max-width: 56rem;
      margin: 0 auto var(--space-8);
      border-radius: var(--radius-lg);
      overflow: hidden;
      background: var(--color-neutral-02);

      img {
        object-fit: cover;
      }
    }

    /*
     * [innerHTML] content is parsed by the browser, not Angular's template
     * compiler, so it never gets the emulated-encapsulation host attribute
     * — a plain scoped ".body h2 {}" rule silently matches nothing. ::ng-deep
     * is deprecated but is still the documented way to reach content an
     * Angular component doesn't render itself; scoped to .body so it can't
     * leak into anything else on the page.
     */
    .body {
      @include type.body-1;
      max-width: 42rem;
      margin: 0 auto;
      color: var(--color-neutral-06);

      ::ng-deep h2 {
        @include type.headline-6;
        margin: var(--space-8) 0 var(--space-3);
        color: var(--color-neutral-07);
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
        color: var(--color-neutral-07);
        text-decoration: underline;
      }
    }

    .message {
      @include type.body-2;
      color: var(--color-neutral-04);
    }

    .comments {
      max-width: 42rem;
      margin: var(--space-10) auto 0;
      padding-top: var(--space-8);
      border-top: 1px solid var(--color-neutral-03);
    }

    .comments h2 {
      @include type.headline-6;
      margin: 0 0 var(--space-6);
      color: var(--color-neutral-07);
    }

    .empty {
      @include type.body-2;
      color: var(--color-neutral-04);
    }

    .comment-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin: 0 0 var(--space-8);
      padding: 0;
      list-style: none;
    }

    .comment {
      padding-bottom: var(--space-4);
      border-bottom: 1px solid var(--color-neutral-03);
    }

    .comment-head {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-1);

      strong {
        @include type.caption-1-semi;
        color: var(--color-neutral-07);
      }

      span {
        @include type.caption-2;
        color: var(--color-neutral-04);
      }
    }

    .comment p {
      @include type.body-2;
      margin: 0;
      color: var(--color-neutral-06);
    }

    .pending-tag {
      @include type.caption-2-semi;
      color: var(--color-warning);
    }

    .comment-form h3 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);
    }

    .comment-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }

    label {
      @include type.caption-1-semi;
      color: var(--color-neutral-07);
    }

    input,
    textarea {
      @include type.body-2;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-md);
      box-shadow: inset 0 0 0 1px var(--color-border-input);
      color: var(--color-neutral-07);
      resize: vertical;

      &:focus-visible {
        outline: none;
        box-shadow: inset 0 0 0 1px var(--color-info);
      }
    }

    .error {
      @include type.caption-2;
      margin: 0;
      color: var(--color-error);
    }

    .hint {
      @include type.caption-2;
      margin: calc(var(--space-2) * -1) 0 0;
      color: var(--color-neutral-04);
    }
  `,
})
export default class BlogPost {
  private readonly blog = inject(BlogService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly slug = input.required<string>();

  protected readonly post = this.blog.postResource(() => this.slug());
  protected readonly comments = this.blog.commentsResource(() => this.post.value()?.id);

  protected readonly pendingComments = signal<CommentDto[]>([]);
  protected readonly submitting = signal(false);

  private readonly model = signal<CommentFormModel>({
    authorName: [this.auth.currentUser()?.firstName, this.auth.currentUser()?.lastName]
      .filter(Boolean)
      .join(' '),
    authorEmail: this.auth.currentUser()?.email ?? '',
    body: '',
  });

  protected readonly commentForm = form(this.model, (f) => {
    required(f.authorName, { message: 'Name is required' });
    required(f.authorEmail, { message: 'Email is required' });
    email(f.authorEmail, { message: 'Enter a valid email address' });
    required(f.body, { message: 'Comment cannot be empty' });
  });

  protected onSubmitComment(event: SubmitEvent): void {
    event.preventDefault();
    this.commentForm().markAsTouched();
    const postId = this.post.value()?.id;
    if (!this.commentForm().valid() || this.submitting() || !postId) return;

    this.submitting.set(true);
    const input = this.model();
    this.blog.submitComment(postId, input).subscribe({
      next: (comment) => {
        this.submitting.set(false);
        this.pendingComments.update((list) => [...list, comment]);
        this.model.set({ authorName: input.authorName, authorEmail: input.authorEmail, body: '' });
        this.commentForm().reset();
        this.toast.show('Comment submitted — awaiting moderation', 'success');
      },
      error: () => this.submitting.set(false),
    });
  }
}
