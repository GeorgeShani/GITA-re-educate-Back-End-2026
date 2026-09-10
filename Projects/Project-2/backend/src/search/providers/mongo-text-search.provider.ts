import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, SortOrder, Types } from 'mongoose';

import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import {
  ProductSearchQuery,
  ProductSearchResult,
  SearchProvider,
} from '@/search/search-provider.interface';

// Same field ranking AtlasSearchProvider applies via `score.boost`
// (name > brand > description > tags) — here it's the `weights` on the
// `product_text` index declared in product.schema.ts. The two providers
// stay interchangeable behind SEARCH_PROVIDER_TOKEN; this one just needs
// no out-of-band index provisioning (SCOPE.md B3 gotcha #6).
const SORT_FIELD_MAP: Record<
  NonNullable<ProductSearchQuery['sort']>,
  string
> = {
  price: 'basePriceMinor',
  newest: 'createdAt',
  rating: 'ratingAverage',
  popularity: 'ratingCount',
};

/**
 * MongoDB `$text` implementation of SearchProvider — the default until
 * `SEARCH_PROVIDER=atlas` is set with the Atlas Search index in place.
 * Works on any MongoDB deployment: relevance comes from the built-in
 * text-index `textScore`, weighted by the `product_text` index.
 */
@Injectable()
export class MongoTextSearchProvider implements SearchProvider {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async searchProducts(
    query: ProductSearchQuery,
  ): Promise<ProductSearchResult> {
    const text = query.text?.trim();
    if (!text) {
      return { productIds: [], total: 0 };
    }

    const filter: Record<string, unknown> = {
      $text: { $search: text },
      publishedAt: { $ne: null },
    };
    if (query.categoryIds?.length) {
      filter.categoryId = { $in: query.categoryIds };
    }
    if (
      query.minPriceMinor !== undefined ||
      query.maxPriceMinor !== undefined
    ) {
      filter.basePriceMinor = {
        ...(query.minPriceMinor !== undefined && { $gte: query.minPriceMinor }),
        ...(query.maxPriceMinor !== undefined && { $lte: query.maxPriceMinor }),
      };
    }

    // `{ score: { $meta: 'textScore' } }` in both the projection and the
    // sort is the documented way to order a $text query by relevance —
    // https://www.mongodb.com/docs/manual/reference/operator/query/text/#sort-by-text-search-score
    const relevanceSort = { score: { $meta: 'textScore' } } as const;
    const sort: Record<string, SortOrder | { $meta: 'textScore' }> = query.sort
      ? { [SORT_FIELD_MAP[query.sort]]: query.order === 'asc' ? 1 : -1, _id: -1 }
      : relevanceSort;

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter, { score: { $meta: 'textScore' } })
        .sort(sort)
        .skip((query.page - 1) * query.take)
        .limit(query.take)
        .select('_id')
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      productIds: items.map((item) => item._id as Types.ObjectId),
      total,
    };
  }

  async typeahead(prefix: string, limit: number): Promise<string[]> {
    const text = prefix.trim();
    if (!text) return [];

    // Atlas' `autocomplete` operator needs an edge-ngram index; without
    // it, a case-insensitive "contains" on the product name is the
    // closest no-setup approximation. Anchored to a word boundary so
    // "grip" matches "RainGrip" and "All-Weather Grip" but not a stray
    // substring mid-word.
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pipeline: PipelineStage[] = [
      {
        $match: {
          name: { $regex: `\\b${escaped}`, $options: 'i' },
          publishedAt: { $ne: null },
        },
      },
      { $sort: { ratingCount: -1, _id: -1 } },
      { $limit: limit },
      { $project: { _id: 0, name: 1 } },
    ];

    const rows = await this.productModel.aggregate<{ name: string }>(pipeline);
    return rows.map((row) => row.name);
  }
}
