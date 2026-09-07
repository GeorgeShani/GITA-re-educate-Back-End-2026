import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, SortOrder, Types } from 'mongoose';

import { SEARCH_PROVIDER_TOKEN } from '@/search/search-provider.interface';
import type { SearchProvider } from '@/search/search-provider.interface';
import { CategoriesService } from './categories.service';
import { FindProductsDto } from './dto/find-products.dto';
import { Product, ProductDocument } from './schemas/product.schema';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  take: number;
}

export interface ProductFacets {
  brands: { brand: string; count: number }[];
  priceRange: { min: number; max: number };
}

const RELATED_PRODUCTS_LIMIT = 8;

const SORT_FIELD_MAP: Record<NonNullable<FindProductsDto['sort']>, string> = {
  price: 'basePriceMinor',
  newest: 'createdAt',
  rating: 'ratingAverage',
  // No order-volume tracking yet (orders land in S9) — ratingCount is
  // the closest available proxy for "how many people engaged with this."
  popularity: 'ratingCount',
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @Inject(SEARCH_PROVIDER_TOKEN)
    private readonly searchProvider: SearchProvider,
    private readonly categoriesService: CategoriesService,
  ) {}

  async findAll(
    query: FindProductsDto,
  ): Promise<PaginatedResult<ProductDocument>> {
    const { page = 1, take = 30 } = query;

    const categoryIds = await this.resolveCategoryIds(query.category);

    if (query.q) {
      return this.findViaSearch(query, page, take, categoryIds);
    }

    const filter = this.buildFilter(query, categoryIds);
    const sort = this.buildSort(query.sort, query.order);

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findBySlug(slug: string): Promise<ProductDocument> {
    const product = await this.productModel
      .findOne({ slug, publishedAt: { $ne: null } })
      .exec();
    if (!product) {
      throw new NotFoundException(`Product "${slug}" not found`);
    }
    return product;
  }

  async findRelated(product: ProductDocument): Promise<ProductDocument[]> {
    return this.productModel
      .find({
        categoryId: product.categoryId,
        _id: { $ne: product._id },
        publishedAt: { $ne: null },
      })
      .limit(RELATED_PRODUCTS_LIMIT)
      .exec();
  }

  /** Batch fetch for a client-tracked recently-viewed list (localStorage ids, not server-tracked). */
  async findByIds(ids: string[]): Promise<ProductDocument[]> {
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    return this.productModel
      .find({ _id: { $in: objectIds }, publishedAt: { $ne: null } })
      .exec();
  }

  typeahead(prefix: string): Promise<string[]> {
    const TYPEAHEAD_LIMIT = 8;
    return this.searchProvider.typeahead(prefix, TYPEAHEAD_LIMIT);
  }

  async getFacets(categoryId?: string): Promise<ProductFacets> {
    const match: QueryFilter<ProductDocument> = { publishedAt: { $ne: null } };
    // Facets must span the same product set the list query returns, or the
    // brand counts won't add up to what the shopper actually sees.
    const categoryIds = await this.resolveCategoryIds(categoryId);
    if (categoryIds?.length) match.categoryId = { $in: categoryIds };

    const [brandRows, priceRows] = await Promise.all([
      this.productModel.aggregate<{ _id: string | null; count: number }>([
        { $match: match },
        { $group: { _id: '$brand', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.productModel.aggregate<{ min: number; max: number }>([
        { $match: match },
        {
          $group: {
            _id: null,
            min: { $min: '$basePriceMinor' },
            max: { $max: '$basePriceMinor' },
          },
        },
      ]),
    ]);

    return {
      brands: brandRows
        .filter((row) => row._id)
        .map((row) => ({ brand: row._id as string, count: row.count })),
      priceRange: priceRows[0]
        ? { min: priceRows[0].min, max: priceRows[0].max }
        : { min: 0, max: 0 },
    };
  }

  private async findViaSearch(
    query: FindProductsDto,
    page: number,
    take: number,
    categoryIds?: Types.ObjectId[],
  ): Promise<PaginatedResult<ProductDocument>> {
    const result = await this.searchProvider.searchProducts({
      text: query.q,
      categoryIds,
      minPriceMinor: query.minPrice,
      maxPriceMinor: query.maxPrice,
      page,
      take,
      sort: query.sort,
      order: query.order,
    });

    const products = await this.productModel
      .find({ _id: { $in: result.productIds } })
      .exec();
    const byId = new Map(products.map((product) => [product.id, product]));
    // $in doesn't preserve order — Atlas Search's relevance ranking does
    // (result.productIds is already in the right order), so re-derive
    // the list from it rather than trusting Mongo's own ordering.
    const items: ProductDocument[] = [];
    for (const id of result.productIds) {
      const product = byId.get(id.toString());
      if (product) items.push(product);
    }

    return { items, total: result.total, page, take };
  }

  /**
   * Expands a category id to itself plus every descendant, so browsing a
   * parent surfaces products filed under its children. Returns undefined
   * when no category filter was requested.
   */
  private async resolveCategoryIds(
    categoryId?: string,
  ): Promise<Types.ObjectId[] | undefined> {
    if (!categoryId) return undefined;
    return this.categoriesService.findSelfAndDescendantIds(categoryId);
  }

  private buildFilter(
    query: FindProductsDto,
    categoryIds?: Types.ObjectId[],
  ): QueryFilter<ProductDocument> {
    const filter: QueryFilter<ProductDocument> = { publishedAt: { $ne: null } };

    if (categoryIds?.length) filter.categoryId = { $in: categoryIds };
    if (query.brand) filter.brand = query.brand;
    if (query.isFeatured !== undefined) filter.isFeatured = query.isFeatured;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter.basePriceMinor = {
        ...(query.minPrice !== undefined && { $gte: query.minPrice }),
        ...(query.maxPrice !== undefined && { $lte: query.maxPrice }),
      };
    }

    return filter;
  }

  private buildSort(
    sort: FindProductsDto['sort'],
    order: FindProductsDto['order'],
  ): Record<string, SortOrder> {
    const field = sort ? SORT_FIELD_MAP[sort] : 'createdAt';
    const direction: SortOrder = order === 'asc' ? 1 : -1;
    // _id breaks ties so the sort is a total order. Without it, documents
    // sharing a sort value (bulk-seeded products share createdAt, and any
    // two products can share a price) have no defined order between them,
    // and skip/limit can then return the same document on two pages while
    // omitting another entirely.
    return { [field]: direction, _id: 1 };
  }
}
