import { Service } from '@angular/core';
import { of, type Observable } from 'rxjs';

import type { Product } from '@/app/core/models/product.model';
import { PRODUCT_FIXTURES } from './product.fixtures';
import { ProductService, type ProductListFilters } from './product.service';

// Not auto-provided — app.config.ts wires this in explicitly against the
// ProductService token (`{ provide: ProductService, useClass:
// MockProductService }`), swappable for a real implementation later.
@Service({ autoProvided: false })
export class MockProductService implements ProductService {
  list(filters?: ProductListFilters): Observable<Product[]> {
    let results = PRODUCT_FIXTURES;
    if (filters?.category) results = results.filter((p) => p.category === filters.category);
    if (filters?.featured) results = results.filter((p) => p.isFeatured);
    return of(results);
  }

  getBySlug(slug: string): Observable<Product | undefined> {
    return of(PRODUCT_FIXTURES.find((p) => p.slug === slug));
  }
}
