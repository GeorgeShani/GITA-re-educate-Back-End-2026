import { httpResource } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  CategoryTreeNodeDto,
  Paginated,
  ProductDto,
  ProductFacetsDto,
  ProductQuery,
  StockDto,
} from '@/app/core/api/dto';
import { API_BASE_URL, ApiClient } from '@/app/core/services/api-client';
import type { ProductCardBadge, ProductCardProduct } from '@/app/shared/ui/product-card';

/**
 * Read side of the catalog.
 *
 * List/detail reads are exposed as `httpResource` factories rather than
 * Observables: they give a signal-shaped `value`/`isLoading`/`error` triple
 * that templates can read directly, and they cooperate with the SSR
 * transfer cache so a server-rendered page does not refetch on hydration.
 * Imperative one-shot calls (typeahead, stock lookups) stay Observable —
 * they are events, not state.
 */
@Service()
export class CatalogService {
  private readonly api = inject(ApiClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * Products for a reactive query. Pass a signal-returning function; the
   * resource refetches whenever it changes.
   *
   * `sort`/`order` are always sent explicitly. The API's default ordering is
   * easy to misread, and leaving it implicit makes a list silently reorder
   * when the backend default changes.
   */
  productsResource(query: () => ProductQuery) {
    return httpResource<Paginated<ProductDto>>(() => ({
      url: `${this.baseUrl}/products`,
      params: toParams({ sort: 'newest', order: 'desc', ...query() }),
    }));
  }

  productResource(slug: () => string | undefined) {
    return httpResource<ProductDto>(() => {
      const value = slug();
      return value ? { url: `${this.baseUrl}/products/${value}` } : undefined;
    });
  }

  relatedResource(slug: () => string | undefined) {
    return httpResource<ProductDto[]>(() => {
      const value = slug();
      return value ? { url: `${this.baseUrl}/products/${value}/related` } : undefined;
    });
  }

  facetsResource(categoryId: () => string | undefined) {
    return httpResource<ProductFacetsDto>(() => ({
      url: `${this.baseUrl}/products/facets`,
      params: toParams({ category: categoryId() }),
    }));
  }

  categoryTreeResource() {
    return httpResource<CategoryTreeNodeDto[]>(() => ({
      url: `${this.baseUrl}/categories`,
    }));
  }

  typeahead(q: string): Observable<string[]> {
    return this.api.get<string[]>('/products/typeahead', { q });
  }

  stock(productId: string, variantSku: string): Observable<StockDto> {
    return this.api.get<StockDto>('/inventory/stock', {
      productId,
      variantSku,
    });
  }
}

/**
 * Maps a product to the card's view shape.
 *
 * The card renders through price-tag, which formats with CurrencyPipe and
 * therefore expects major units — so the conversion happens here, at the
 * presentation boundary. Nothing downstream does arithmetic on these
 * numbers; they go straight to a formatter.
 */
export function toCardProduct(product: ProductDto): ProductCardProduct {
  const badges: ProductCardBadge[] = [];
  if (product.compareAtPriceMinor) {
    badges.push({ label: 'Sale', variant: 'sale' });
  }

  return {
    slug: product.slug,
    name: product.name,
    image: product.images[0]?.url ?? '',
    price: product.basePriceMinor / 100,
    originalPrice: product.compareAtPriceMinor ? product.compareAtPriceMinor / 100 : undefined,
    rating: product.ratingAverage || undefined,
    reviewCount: product.ratingCount || undefined,
    badges: badges.length ? badges : undefined,
  };
}

/** Drops undefined keys — the API rejects unknown/empty params outright. */
function toParams(
  query: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(query).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean>;
}
