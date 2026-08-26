import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage, Types } from 'mongoose';

import { Product, ProductDocument } from '../../catalog/schemas/product.schema';
import {
  ProductSearchQuery,
  ProductSearchResult,
  SearchProvider,
} from '../search-provider.interface';

// mongoose's PipelineStage union doesn't include $search or $searchMeta —
// they're Atlas-only, not part of vanilla MongoDB's aggregation grammar
// mongoose types against. Cast at the aggregate() call site rather than
// losing type safety on every other stage in the pipeline.
interface AtlasSearchStage {
  $search: {
    index: string;
    compound: {
      should: Array<{
        text: {
          query: string;
          path: string;
          score: { boost: { value: number } };
        };
      }>;
      minimumShouldMatch: number;
    };
  };
}

const SEARCH_INDEX_NAME = 'products_search';

// SCOPE.md Phase 3 — weighted title > brand > description > tags via
// the `$search` aggregation stage. Requires a search index named
// "products_search" provisioned through the Atlas UI/API (SCOPE.md B3
// gotcha #6) — this is genuinely a separate setup step, not something
// that comes along with the Mongoose schema. See the storefront backend
// plan's secrets guide for exact field mappings to configure.
@Injectable()
export class AtlasSearchProvider implements SearchProvider {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async searchProducts(
    query: ProductSearchQuery,
  ): Promise<ProductSearchResult> {
    if (!query.text) {
      return { productIds: [], total: 0 };
    }

    const searchStage: AtlasSearchStage = {
      $search: {
        index: SEARCH_INDEX_NAME,
        compound: {
          should: [
            {
              text: {
                query: query.text,
                path: 'name',
                score: { boost: { value: 5 } },
              },
            },
            {
              text: {
                query: query.text,
                path: 'brand',
                score: { boost: { value: 3 } },
              },
            },
            {
              text: {
                query: query.text,
                path: 'description',
                score: { boost: { value: 1.5 } },
              },
            },
            {
              text: {
                query: query.text,
                path: 'tags',
                score: { boost: { value: 1 } },
              },
            },
          ],
          minimumShouldMatch: 1,
        },
      },
    };

    // categoryId/price/publishedAt are plain equality/range conditions —
    // handled with a regular $match rather than Atlas Search filter
    // clauses, so only name/brand/description/tags need to be mapped in
    // the search index itself.
    const matchStage: Record<string, unknown> = { publishedAt: { $ne: null } };
    if (query.categoryId) matchStage.categoryId = query.categoryId;
    if (
      query.minPriceMinor !== undefined ||
      query.maxPriceMinor !== undefined
    ) {
      matchStage.basePriceMinor = {
        ...(query.minPriceMinor !== undefined && { $gte: query.minPriceMinor }),
        ...(query.maxPriceMinor !== undefined && { $lte: query.maxPriceMinor }),
      };
    }

    const pipeline = [
      searchStage,
      { $match: matchStage },
      {
        $facet: {
          items: [
            { $skip: (query.page - 1) * query.take },
            { $limit: query.take },
            { $project: { _id: 1 } },
          ],
          totalCount: [{ $count: 'count' }],
        },
      },
    ] as unknown as PipelineStage[];

    const [result] = await this.productModel.aggregate<{
      items: { _id: Types.ObjectId }[];
      totalCount: { count: number }[];
    }>(pipeline);

    return {
      productIds: result?.items.map((item) => item._id) ?? [],
      total: result?.totalCount[0]?.count ?? 0,
    };
  }

  async typeahead(prefix: string, limit: number): Promise<string[]> {
    const pipeline = [
      {
        $search: {
          index: SEARCH_INDEX_NAME,
          autocomplete: { query: prefix, path: 'name' },
        },
      },
      { $match: { publishedAt: { $ne: null } } },
      { $limit: limit },
      { $project: { _id: 0, name: 1 } },
    ] as unknown as PipelineStage[];

    const results = await this.productModel.aggregate<{ name: string }>(
      pipeline,
    );
    return results.map((r) => r.name);
  }
}
