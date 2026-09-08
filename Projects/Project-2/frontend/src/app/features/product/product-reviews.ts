import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';

import type { ProductDto } from '@/app/core/api/dto';
import { AuthService } from '@/app/core/services/auth.service';
import { ReviewsService } from '@/app/core/services/reviews.service';
import { ToastService } from '@/app/core/services/toast.service';
import { ActionButton } from '@/app/shared/ui/action-button';
import { RatingStars } from '@/app/shared/ui/rating-stars';
import { SkeletonBlock } from '@/app/shared/ui/skeleton-block';
import { TextField } from '@/app/shared/ui/text-field';
import { TextareaField } from '@/app/shared/ui/textarea-field';

/**
 * Reviews only ever come back with a bare `userId` (see ReviewDto) — no
 * name, no avatar. Rather than inventing "Verified Customer #4b2a" style
 * placeholders, each review is attributed only by its verified-purchase
 * status and date, which is honest about what the API actually gives us.
 */
@Component({
  selector: 'product-reviews',
  imports: [RatingStars, DatePipe, SkeletonBlock, ActionButton, TextField, TextareaField],
  template: `
    <div class="summary">
      <h2>Customer Reviews</h2>
      <div class="summary-rating">
        <rating-stars [value]="product().ratingAverage" [max]="5" />
        <span class="summary-count">
          {{ product().ratingCount }} {{ product().ratingCount === 1 ? 'review' : 'reviews' }}
        </span>
      </div>
    </div>

    @if (reviews.isLoading()) {
      <div class="list">
        @for (i of [0, 1, 2]; track i) {
          <skeleton-block height="96px" radius="var(--radius-md)" />
        }
      </div>
    } @else if (reviews.value()?.items?.length) {
      <ul class="list" role="list">
        @for (review of reviews.value()!.items; track review.id) {
          <li class="review">
            <div class="review-head">
              <rating-stars [value]="review.rating" [max]="5" />
              @if (review.isVerifiedPurchase) {
                <span class="verified">Verified purchase</span>
              }
              <span class="date">{{ review.createdAt | date: 'mediumDate' }}</span>
            </div>
            @if (review.title; as t) {
              <p class="review-title">{{ t }}</p>
            }
            <p class="review-body">{{ review.body }}</p>
          </li>
        }
      </ul>
    } @else {
      <p class="empty">Be the first to review this product.</p>
    }

    <div class="form-wrap">
      @if (auth.isAuthenticated()) {
        <h3>Share your thoughts</h3>
        <form class="form" (submit)="submit($event)">
          <rating-stars [value]="rating()" [interactive]="true" (valueChange)="rating.set($event)" />
          <text-field
            label="Title (optional)"
            placeholder="Sum it up in one line"
            [value]="title()"
            (valueChange)="title.set($event)"
          />
          <textarea-field
            label="Your review"
            placeholder="What did you think?"
            [value]="body()"
            (valueChange)="body.set($event)"
          />
          <action-button type="submit" size="s" [disabled]="!canSubmit()" [loading]="submitting()">
            Submit review
          </action-button>
        </form>
      } @else {
        <p class="signed-out">Sign in to write a review.</p>
      }
    </div>
  `,
  styles: `
    @use 'styles/typography' as type;

    :host {
      display: block;
    }

    .summary {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      margin-bottom: var(--space-8);
    }

    h2 {
      @include type.headline-6;
      margin: 0;
      color: var(--color-neutral-07);
    }

    .summary-rating {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .summary-count {
      @include type.caption-1;
      color: var(--color-neutral-04);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: var(--space-6);
      margin: 0 0 var(--space-8);
      padding: 0;
      list-style: none;
    }

    .review {
      padding-bottom: var(--space-6);
      border-bottom: 1px solid var(--color-neutral-03);
    }

    .review-head {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin-bottom: var(--space-2);
    }

    .verified {
      @include type.caption-2-semi;
      color: var(--color-success);
    }

    .date {
      @include type.caption-2;
      color: var(--color-neutral-04);
      margin-inline-start: auto;
    }

    .review-title {
      @include type.body-2-semi;
      margin: 0 0 var(--space-1);
      color: var(--color-neutral-07);
    }

    .review-body {
      @include type.body-2;
      margin: 0;
      color: var(--color-neutral-05);
    }

    .empty {
      @include type.body-2;
      margin: 0 0 var(--space-8);
      color: var(--color-neutral-04);
    }

    .form-wrap {
      padding-top: var(--space-6);
      border-top: 1px solid var(--color-neutral-03);
    }

    h3 {
      @include type.body-1-semi;
      margin: 0 0 var(--space-4);
      color: var(--color-neutral-07);
    }

    .form {
      display: flex;
      flex-direction: column;
      align-items: start;
      gap: var(--space-4);
      max-width: 32rem;
    }

    .signed-out {
      @include type.body-2;
      color: var(--color-neutral-04);
    }
  `,
})
export class ProductReviews {
  protected readonly auth = inject(AuthService);
  private readonly reviewsService = inject(ReviewsService);
  private readonly toast = inject(ToastService);

  readonly product = input.required<ProductDto>();

  protected readonly reviews = this.reviewsService.approvedResource(() => this.product().id);

  protected readonly rating = signal(0);
  protected readonly title = signal('');
  protected readonly body = signal('');
  protected readonly submitting = signal(false);

  protected readonly canSubmit = computed(
    () => this.rating() > 0 && this.body().trim().length > 0 && !this.submitting(),
  );

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.canSubmit()) return;

    this.submitting.set(true);
    this.reviewsService
      .submit(this.product().id, this.rating(), this.body().trim(), this.title().trim() || undefined)
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.rating.set(0);
          this.title.set('');
          this.body.set('');
          this.toast.show('Thanks — your review is awaiting approval.', 'success');
        },
        error: () => this.submitting.set(false),
      });
  }
}
