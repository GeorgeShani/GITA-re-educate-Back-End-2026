import { Service, inject, signal } from '@angular/core';
import { map, shareReplay, tap, type Observable } from 'rxjs';

import type { ProductDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

export interface ProductLookupEntry {
  name: string;
  slug: string;
}

/**
 * `AdminInventoryItemDto.productId` / `AdminReviewDto.productId` are raw
 * ObjectId strings — neither `/admin/inventory` nor `/admin/reviews`
 * populates the product (confirmed against both services' source, not
 * assumed), so there's no name/slug anywhere in those responses to show
 * an admin. Fetches every product once (this store's catalog is small
 * enough for a single page) and caches an id -> {name, slug} map other
 * admin pages read synchronously via `get()`, rather than each page
 * re-fetching or showing a bare ObjectId.
 */
@Service()
export class AdminProductLookupService {
  private readonly api = inject(ApiClient);

  private readonly map = signal<Map<string, ProductLookupEntry>>(new Map());
  private loaded$: Observable<Map<string, ProductLookupEntry>> | null = null;

  /** Fire-and-forget: call once per page that needs lookups, before reading get(). */
  ensureLoaded(): Observable<Map<string, ProductLookupEntry>> {
    this.loaded$ ??= this.api
      .get<{ items: ProductDto[]; total: number }>('/admin/products', { take: 1000 })
      .pipe(
        map((result) => {
          const entries = new Map<string, ProductLookupEntry>();
          for (const product of result.items) {
            entries.set(product.id, { name: product.name, slug: product.slug });
          }
          return entries;
        }),
        tap((entries) => this.map.set(entries)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.loaded$;
  }

  get(productId: string): ProductLookupEntry | undefined {
    return this.map().get(productId);
  }
}
