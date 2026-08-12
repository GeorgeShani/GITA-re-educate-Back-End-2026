import type { Observable } from 'rxjs';

import type { Product, ProductCategory } from '@/app/core/models/product.model';

export interface ProductListFilters {
  readonly category?: ProductCategory;
  readonly featured?: boolean;
}

/**
 * Abstract class used as an injection token — provide MockProductService
 * now, swap in a real HTTP-backed implementation once the backend exists
 * (app.config.ts's provider entry is the only thing that changes; no
 * consuming component does).
 */
export abstract class ProductService {
  abstract list(filters?: ProductListFilters): Observable<Product[]>;
  abstract getBySlug(slug: string): Observable<Product | undefined>;
}
