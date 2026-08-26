import { Types } from 'mongoose';

export interface ProductSearchQuery {
  text?: string;
  categoryId?: Types.ObjectId;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  page: number;
  take: number;
  sort?: 'price' | 'newest' | 'rating' | 'popularity';
  order?: 'asc' | 'desc';
}

export interface ProductSearchResult {
  productIds: Types.ObjectId[];
  total: number;
}

// SCOPE.md Phase 3 — "SearchProvider stays abstract so Meilisearch can
// still drop in later without touching callers." One implementation
// right now (AtlasSearchProvider), same pattern as StorageProvider/
// MailProvider. Returns ids + a total, not hydrated documents — callers
// re-fetch from the Product collection so search relevance ordering and
// document shape are separate concerns.
export interface SearchProvider {
  searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult>;
  typeahead(prefix: string, limit: number): Promise<string[]>;
}

export const SEARCH_PROVIDER_TOKEN = Symbol('SEARCH_PROVIDER');
