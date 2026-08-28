import { Injectable } from '@nestjs/common';
import type { FunctionDeclaration } from '@google/genai';

import { CategoriesService } from '@/catalog/categories.service';
import { ProductsService } from '@/catalog/products.service';
import { AssistantTool } from './assistant-tool.interface';

@Injectable()
export class SearchProductsTool implements AssistantTool {
  readonly mutating = false;

  readonly declaration: FunctionDeclaration = {
    name: 'search_products',
    description:
      'Search the golf product catalog by free text, category, and price range. Returns product slugs to use with get_product/add_to_cart.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Free-text search, e.g. "waterproof gloves"',
        },
        categorySlug: {
          type: 'string',
          description: 'A category slug from get_categories, e.g. "gloves"',
        },
        minPriceMinor: {
          type: 'integer',
          description: 'Minimum price in minor units (cents)',
        },
        maxPriceMinor: {
          type: 'integer',
          description: 'Maximum price in minor units (cents)',
        },
        take: {
          type: 'integer',
          description: 'Max results to return (default 10, max 20)',
        },
      },
    },
  };

  constructor(
    private readonly productsService: ProductsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    let categoryId: string | undefined;
    if (typeof args.categorySlug === 'string') {
      const category = await this.categoriesService
        .findBySlug(args.categorySlug)
        .catch(() => null);
      if (!category) {
        return { error: `Unknown category "${args.categorySlug}"` };
      }
      categoryId = category.id;
    }

    const take = typeof args.take === 'number' ? Math.min(args.take, 20) : 10;

    const result = await this.productsService.findAll({
      q: typeof args.query === 'string' ? args.query : undefined,
      category: categoryId,
      minPrice:
        typeof args.minPriceMinor === 'number' ? args.minPriceMinor : undefined,
      maxPrice:
        typeof args.maxPriceMinor === 'number' ? args.maxPriceMinor : undefined,
      page: 1,
      take,
      order: 'asc',
    });

    return {
      total: result.total,
      products: result.items.map((product) => ({
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        basePriceMinor: product.basePriceMinor,
        compareAtPriceMinor: product.compareAtPriceMinor,
      })),
    };
  }
}
