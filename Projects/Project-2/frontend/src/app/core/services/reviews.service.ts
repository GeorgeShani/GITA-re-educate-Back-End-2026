import { httpResource } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { Paginated, ReviewDto } from '@/app/core/api/dto';
import { API_BASE_URL, ApiClient } from '@/app/core/services/api-client';

/**
 * Read side is `httpResource` (approved reviews for a product, refetches
 * whenever the product changes) matching CatalogService's pattern.
 * Submission is imperative — it's a one-shot mutation, not state a
 * template reads reactively.
 */
@Service()
export class ReviewsService {
  private readonly api = inject(ApiClient);
  private readonly baseUrl = inject(API_BASE_URL);

  approvedResource(productId: () => string | undefined) {
    return httpResource<Paginated<ReviewDto>>(() => {
      const id = productId();
      return id ? { url: `${this.baseUrl}/reviews`, params: { productId: id } } : undefined;
    });
  }

  /**
   * Verified-purchase status is decided server-side from order history —
   * never send it from here, there is nothing honest the client could send.
   */
  submit(productId: string, rating: number, body: string, title?: string): Observable<ReviewDto> {
    return this.api.post<ReviewDto>('/reviews', { productId, rating, body, title });
  }
}
